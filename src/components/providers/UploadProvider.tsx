'use client';

import * as React from 'react';
import {
  abortMultipartUpload,
  ApiError,
  deleteUploadJob,
  isUploadCancelled,
} from '@/lib/api';
import {
  resumeDataFiles,
  uploadDataFiles,
  type UploadBatchResult,
  type UploadFileProgress,
  type UploadSignals,
} from '@/lib/data-assets';

export type GlobalUploadStatus = 'idle' | 'uploading' | 'canceling' | 'completed' | 'failed' | 'needs_file';

export interface GlobalUploadState {
  status: GlobalUploadStatus;
  progress: number;
  files: UploadFileProgress[];
  read1Name?: string;
  read2Name?: string;
  read1Size?: number;
  read2Size?: number;
  read1LastModified?: number;
  read2LastModified?: number;
  error?: string;
  startedAt?: string;
}

interface StartUploadOptions {
  read1: File | null;
  read2: File | null;
  uploadPolicyAcknowledged: boolean;
  internalId: string;
}

interface UploadContextValue {
  activeUpload: GlobalUploadState | null;
  canceling: boolean;
  startUpload: (options: StartUploadOptions) => Promise<void>;
  cancelFile: (fileId: string) => void;
  forgetFile: (fileId: string) => void;
  pruneFiles: (fileIds: string[]) => void;
  markFileFailed: (fileId: string, message?: string) => void;
  cancelUpload: () => Promise<void>;
  clearUpload: () => void;
}

type UploadReadType = 'read1' | 'read2' | 'single' | 'bed';

interface UploadRun {
  controllers: Map<string, AbortController>;
  controllersByReadType: Partial<Record<UploadReadType, AbortController>>;
  fileToReadType: Map<string, UploadReadType>;
  jobId?: string;
  fullCancelRequested: boolean;
}

const UploadContext = React.createContext<UploadContextValue | null>(null);
const PERSISTED_UPLOAD_KEY = 'schema:active-upload:v1';

function isTerminalFile(file: UploadFileProgress) {
  return file.status === 'completed' || file.status === 'cancelled' || file.status === 'deleted';
}

function readPersistedUpload(): GlobalUploadState | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(PERSISTED_UPLOAD_KEY) || 'null') as GlobalUploadState | null;
    if (!value) return null;
    if (!value.read1Name && !value.read2Name) {
      window.localStorage.removeItem(PERSISTED_UPLOAD_KEY);
      return null;
    }
    const files = (value.files ?? []).filter((file) => !isTerminalFile(file));
    if (files.length === 0) {
      // A previous run may have reached a terminal state immediately before
      // the page was closed. Remove that stale marker before rendering so a
      // refresh can never resurrect an empty recovery prompt.
      window.localStorage.removeItem(PERSISTED_UPLOAD_KEY);
      return null;
    }
    // File objects cannot survive a browser reload. Keep only non-terminal
    // metadata visible so the data page can ask the user to select the same
    // files and resume the server-side multipart session.
    return { ...value, files, status: 'needs_file', error: undefined };
  } catch {
    return null;
  }
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  // The provider itself is mounted above the route tree, so the in-memory
  // state survives navigation. Keep the initial render identical on the
  // server and browser: reading localStorage from a lazy initializer would
  // make the browser hydrate with `needs_file` while SSR rendered `null`.
  // Durable metadata is restored after mount instead.
  const [activeUpload, setActiveUpload] = React.useState<GlobalUploadState | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const activeUploadRef = React.useRef<GlobalUploadState | null>(activeUpload);
  const uploadRunRef = React.useRef<UploadRun | null>(null);

  // Keep a synchronous mirror of the state used by cleanup paths. React state
  // effects run after paint, so relying on the effect alone can miss a
  // multipart session when an upload fails immediately after it is created.
  const updateUploadState = React.useCallback((updater: React.SetStateAction<GlobalUploadState | null>) => {
    setActiveUpload((current) => {
      const next = typeof updater === 'function'
        ? (updater as (value: GlobalUploadState | null) => GlobalUploadState | null)(current)
        : updater;
      activeUploadRef.current = next;
      return next;
    });
  }, []);

  React.useEffect(() => {
    activeUploadRef.current = activeUpload;
  }, [activeUpload]);

  React.useEffect(() => {
    const restored = readPersistedUpload();
    if (restored) {
      activeUploadRef.current = restored;
      setActiveUpload(restored);
    }
    setHydrated(true);
  }, []);

  const cleanupMultipartSessions = React.useCallback(async (state: GlobalUploadState | null) => {
    const sessions = (state?.files ?? []).filter((file) => file.multipartSessionId && file.status !== 'completed');
    await Promise.allSettled(sessions.map((file) => abortMultipartUpload(file.fileId, file.multipartSessionId!)));
  }, []);

  const persist = React.useCallback((value: GlobalUploadState | null) => {
    if (typeof window === 'undefined') return;
    const files = (value?.files ?? []).filter((file) => !isTerminalFile(file));
    if (!value || files.length === 0) {
      window.localStorage.removeItem(PERSISTED_UPLOAD_KEY);
      return;
    }
    const durable = {
      ...value,
      // Progress is informational after a reload; the server is authoritative.
      files: files.map((file) => ({ ...file })),
    };
    window.localStorage.setItem(PERSISTED_UPLOAD_KEY, JSON.stringify(durable));
  }, []);

  React.useEffect(() => {
    // Do not remove a durable record during the initial null render. The
    // restore effect above must run first after a full page refresh.
    if (!hydrated) return;
    persist(activeUpload);
  }, [activeUpload, hydrated, persist]);

  const startUpload = React.useCallback(async ({ read1, read2, uploadPolicyAcknowledged, internalId }: StartUploadOptions) => {
    if (!read1 && !read2) throw new Error('请至少选择一个文件');
    const initial: GlobalUploadState = {
      status: 'uploading',
      progress: 0,
      files: [],
      read1Name: read1?.name,
      read2Name: read2?.name,
      read1Size: read1?.size,
      read2Size: read2?.size,
      read1LastModified: read1?.lastModified,
      read2LastModified: read2?.lastModified,
      startedAt: new Date().toISOString(),
    };
    const previous = activeUploadRef.current?.status === 'needs_file' ? activeUploadRef.current : null;
    const canResume = Boolean(previous && previous.files.length > 0 &&
      previous.files.every((item) => {
        const file = item.readType === 'read1' ? read1 : read2;
        return file && file.name === item.fileName &&
          (item.fileSize === undefined || file.size === item.fileSize) &&
          (item.lastModified === undefined || file.lastModified === item.lastModified);
      }));
    if (previous && previous.files.length > 0 && !canResume) {
      throw new Error('请选择上次上传的全部未完成原文件（文件名、大小和修改时间必须一致），或先放弃恢复记录');
    }

    const controllersByReadType: Partial<Record<UploadReadType, AbortController>> = {};
    const controllers = new Map<string, AbortController>();
    const fileToReadType = new Map<string, UploadReadType>();
    if (canResume && previous) {
      previous.files.forEach((item) => {
        const readType = item.readType as UploadReadType;
        const controller = new AbortController();
        controllersByReadType[readType] = controller;
        controllers.set(item.fileId, controller);
        fileToReadType.set(item.fileId, readType);
      });
    } else {
      if (read1) controllersByReadType.read1 = new AbortController();
      if (read2) controllersByReadType.read2 = new AbortController();
    }
    const run: UploadRun = { controllers, controllersByReadType, fileToReadType, fullCancelRequested: false };
    if (canResume && previous) run.jobId = previous.files.find((file) => file.jobId)?.jobId;
    const starting = canResume && previous
      ? {
        ...previous,
        status: 'uploading' as const,
        error: undefined,
        files: previous.files.map((file) => ({ ...file, status: 'uploading' as const })),
      }
      : initial;
    uploadRunRef.current = run;
    activeUploadRef.current = starting;
    setActiveUpload(starting);
    try {
      const onProgress = (progress: number) => {
        updateUploadState((current) => {
          if (!current || current.status !== 'uploading') return current;
          return { ...current, progress, status: 'uploading' as const };
        });
      };
      const callbacks = {
        onStarted: (files: UploadFileProgress[]) => {
          files.forEach((file) => {
            run.fileToReadType.set(file.fileId, file.readType as UploadReadType);
            if (file.jobId) run.jobId = file.jobId;
            if (!run.controllers.has(file.fileId)) {
              const controller = run.controllersByReadType[file.readType as UploadReadType] ?? new AbortController();
              run.controllers.set(file.fileId, controller);
              run.controllersByReadType[file.readType as UploadReadType] = controller;
            }
          });
          updateUploadState((current) => {
            if (!current || current.status !== 'uploading') return current;
            return { ...current, files, status: 'uploading' as const };
          });
        },
        onFileProgress: (file: UploadFileProgress) => {
          updateUploadState((current) => {
            if (!current) return current;
            const existing = current.files.find((item) => item.fileId === file.fileId);
            if (existing && (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'deleted' || existing.status === 'cancelled')) {
              // A late progress callback can arrive after the delete request
              // has failed or succeeded. Never let it resurrect a terminal
              // file in the upload list.
              return current;
            }
            const status = existing?.status === 'canceling' ? 'canceling' as const : file.status ?? 'uploading' as const;
            const files = current.files.map((item) => item.fileId === file.fileId
              ? {
                ...item,
                ...file,
                status,
                multipartSessionId: file.multipartSessionId ?? item.multipartSessionId,
                completedParts: file.completedParts ?? item.completedParts,
              }
              : item);
            return { ...current, files };
          });
        },
        onMultipartState: (fileId: string, sessionId: string, completedParts: number[]) => {
          updateUploadState((current) => {
            if (!current) return current;
            const files = current.files.map((item) => item.fileId === fileId
              ? { ...item, multipartSessionId: sessionId, completedParts }
              : item);
            return { ...current, files };
          });
        },
      };
      const signals: UploadSignals = {
        read1: controllersByReadType.read1?.signal,
        read2: controllersByReadType.read2?.signal,
        single: controllersByReadType.single?.signal,
        bed: controllersByReadType.bed?.signal,
      };
      let result: UploadBatchResult;
      if (canResume && previous) {
        result = await resumeDataFiles(read1, read2, previous.files, onProgress, callbacks, signals);
      } else {
        result = await uploadDataFiles(read1, read2, uploadPolicyAcknowledged, internalId, onProgress, callbacks, signals);
      }
      if (run.fullCancelRequested || uploadRunRef.current !== run) return;
      const cancelled = new Set(result?.cancelledFileIds ?? []);
      updateUploadState((current) => {
        if (!current) return null;
        const files = current.files.map((file) => {
          if (file.status === 'failed' || file.status === 'deleted') return file;
          if (file.status === 'cancelled') return file;
          if (file.status === 'canceling') return { ...file, status: 'cancelled' as const };
          if (cancelled.has(file.fileId)) return { ...file, status: 'cancelled' as const };
          return { ...file, status: 'completed' as const, progress: 100 };
        });
        const hasFailure = files.some((file) => file.status === 'failed');
        return { ...current, files, status: hasFailure ? 'failed' as const : 'completed' as const, progress: 100, error: hasFailure ? current.error : undefined };
      });
      uploadRunRef.current = null;
    } catch (error) {
      if (run.fullCancelRequested || uploadRunRef.current !== run) return;
      if (isUploadCancelled(error)) {
        updateUploadState((current) => current ? { ...current, status: 'failed' as const, error: '上传已取消' } : null);
        uploadRunRef.current = null;
        return;
      }
      // A real transport/API failure keeps the paired upload all-or-nothing:
      // stop any sibling request that Promise.all may still have running
      // before cleaning up its durable multipart sessions.
      run.controllers.forEach((controller) => controller.abort());
      await cleanupMultipartSessions(activeUploadRef.current);
      const message = error instanceof Error ? error.message : '上传失败';
      updateUploadState((current) => current
        ? { ...current, status: 'failed' as const, error: message, files: current.files.map((file) => ({ ...file, status: file.status === 'completed' ? 'completed' as const : 'failed' as const })) }
        : { ...initial, status: 'failed' as const, error: message });
      uploadRunRef.current = null;
      throw error;
    }
  }, [cleanupMultipartSessions, updateUploadState]);

  const cancelFile = React.useCallback((fileId: string) => {
    const run = uploadRunRef.current;
    const current = activeUploadRef.current;
    if (!current) return;
    const item = current.files.find((file) => file.fileId === fileId);
    if (!item || item.status === 'completed' || item.status === 'cancelled' || item.status === 'deleted') return;
    run?.controllers.get(fileId)?.abort();
    updateUploadState((state) => state
      ? {
        ...state,
        files: state.files.map((file) => file.fileId === fileId ? { ...file, status: 'canceling' as const } : file),
      }
      : null);
  }, [updateUploadState]);

  const forgetFile = React.useCallback((fileId: string) => {
    updateUploadState((state) => {
      if (!state) return null;
      const files = state.files.filter((file) => file.fileId !== fileId);
      return files.length > 0 ? { ...state, files } : null;
    });
  }, [updateUploadState]);

  const pruneFiles = React.useCallback((fileIds: string[]) => {
    if (fileIds.length === 0) return;
    const removed = new Set(fileIds);
    updateUploadState((state) => {
      if (!state) return null;
      const files = state.files.filter((file) => !removed.has(file.fileId));
      return files.length > 0 ? { ...state, files } : null;
    });
  }, [updateUploadState]);

  const markFileFailed = React.useCallback((fileId: string, message?: string) => {
    const item = activeUploadRef.current?.files.find((file) => file.fileId === fileId);
    uploadRunRef.current?.controllers.get(fileId)?.abort();
    if (item?.multipartSessionId) {
      // Deletion can fail after the browser request was aborted. Best-effort
      // termination prevents orphaned COS parts while the failed file stays
      // retryable in the data center and in local recovery metadata.
      void abortMultipartUpload(item.fileId, item.multipartSessionId).catch(() => undefined);
    }
    updateUploadState((state) => {
      if (!state) return null;
      const files = state.files.map((file) => file.fileId === fileId ? { ...file, status: 'failed' as const } : file);
      const hasActiveFile = files.some((file) => file.status === 'uploading' || file.status === 'canceling');
      return {
        ...state,
        // A paired sibling may still be transferring. Keep the global run
        // visible until it finishes, while the deleted file remains failed.
        status: hasActiveFile ? 'uploading' as const : 'failed' as const,
        error: message ?? state.error,
        files,
      };
    });
  }, [updateUploadState]);

  const cancelUpload = React.useCallback(async () => {
    const run = uploadRunRef.current;
    const state = activeUploadRef.current;
    if (!state) return;
    // The modal can receive two clicks before React paints the canceling
    // state. The first call owns the server DELETE; subsequent calls wait for
    // that call's state transition instead of issuing duplicate deletes.
    if (state.status === 'canceling') return;
    if (run) {
      run.fullCancelRequested = true;
      run.controllers.forEach((controller) => controller.abort());
    }
    activeUploadRef.current = { ...state, status: 'canceling', error: undefined };
    updateUploadState((current) => current ? { ...current, status: 'canceling' as const, error: undefined } : null);
    const jobId = run?.jobId ?? state.files.find((file) => file.jobId)?.jobId;
    if (!jobId) {
      uploadRunRef.current = null;
      persist(null);
      updateUploadState(null);
      return;
    }
    try {
      await deleteUploadJob(jobId);
    } catch (error) {
      const status = error instanceof ApiError
        ? error.status
        : (typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined);
      if (status !== 404) {
        await cleanupMultipartSessions(activeUploadRef.current);
        const message = error instanceof Error ? error.message : '取消上传失败';
        if (uploadRunRef.current === run) uploadRunRef.current = null;
        updateUploadState((current) => current
          ? { ...current, status: 'failed' as const, error: message, files: current.files.map((file) => ({ ...file, status: file.status === 'completed' ? 'completed' as const : 'failed' as const })) }
          : null);
        throw error;
      }
    }
    if (uploadRunRef.current === run) uploadRunRef.current = null;
    persist(null);
    updateUploadState(null);
  }, [cleanupMultipartSessions, persist, updateUploadState]);

  const clearUpload = React.useCallback(() => {
    const run = uploadRunRef.current;
    run?.controllers.forEach((controller) => controller.abort());
    void cleanupMultipartSessions(activeUploadRef.current);
    uploadRunRef.current = null;
    persist(null);
    activeUploadRef.current = null;
    setActiveUpload(null);
  }, [cleanupMultipartSessions, persist]);

  return <UploadContext.Provider value={{ activeUpload, canceling: activeUpload?.status === 'canceling', startUpload, cancelFile, forgetFile, pruneFiles, markFileFailed, cancelUpload, clearUpload }}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const value = React.useContext(UploadContext);
  if (!value) throw new Error('useUpload must be used inside UploadProvider');
  return value;
}
