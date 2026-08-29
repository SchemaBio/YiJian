'use client';

import * as React from 'react';
import { resumeDataFiles, uploadDataFiles, type UploadFileProgress } from '@/lib/data-assets';
import { abortMultipartUpload } from '@/lib/api';

export type GlobalUploadStatus = 'idle' | 'uploading' | 'completed' | 'failed' | 'needs_file';

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
  startUpload: (options: StartUploadOptions) => Promise<void>;
  clearUpload: () => void;
}

const UploadContext = React.createContext<UploadContextValue | null>(null);
const PERSISTED_UPLOAD_KEY = 'schema:active-upload:v1';

function readPersistedUpload(): GlobalUploadState | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(PERSISTED_UPLOAD_KEY) || 'null') as GlobalUploadState | null;
    if (!value || !value.read1Name && !value.read2Name) return null;
    // File objects cannot survive a browser reload. Keep the durable metadata
    // visible so the data page can ask the user to select the same files and
    // resume the server-side multipart session.
    return { ...value, status: 'needs_file', error: undefined };
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
    const sessions = (state?.files ?? []).filter((file) => file.multipartSessionId);
    await Promise.allSettled(sessions.map((file) => abortMultipartUpload(file.fileId, file.multipartSessionId!)));
  }, []);

  const persist = React.useCallback((value: GlobalUploadState | null) => {
    if (typeof window === 'undefined') return;
    if (!value || value.status === 'completed') {
      window.localStorage.removeItem(PERSISTED_UPLOAD_KEY);
      return;
    }
    const durable = {
      ...value,
      // Progress is informational after a reload; the server is authoritative.
      files: value.files.map((file) => ({ ...file })),
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
      throw new Error('请选择上次上传的全部原文件（文件名、大小和修改时间必须一致），或先放弃恢复记录');
    }
    const starting = canResume && previous ? { ...previous, status: 'uploading' as const, error: undefined } : initial;
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
          updateUploadState((current) => {
            if (!current || current.status !== 'uploading') return current;
            return { ...(current || starting), files, status: 'uploading' as const };
          });
        },
        onFileProgress: (file: UploadFileProgress) => {
          updateUploadState((current) => {
            if (!current || current.status !== 'uploading') return current;
            const files = current.files.map((item) => item.fileId === file.fileId
              ? {
                ...item,
                ...file,
                multipartSessionId: file.multipartSessionId ?? item.multipartSessionId,
                completedParts: file.completedParts ?? item.completedParts,
              }
              : item);
            return { ...current, files, status: 'uploading' as const };
          });
        },
        onMultipartState: (fileId: string, sessionId: string, completedParts: number[]) => {
          updateUploadState((current) => {
            if (!current || current.status !== 'uploading') return current;
            const files = current.files.map((item) => item.fileId === fileId
              ? { ...item, multipartSessionId: sessionId, completedParts }
              : item);
            return { ...current, files };
          });
        },
      };
      if (canResume && previous) {
        await resumeDataFiles(read1, read2, previous.files, onProgress, callbacks);
      } else {
        await uploadDataFiles(read1, read2, uploadPolicyAcknowledged, internalId, onProgress, callbacks);
      }
      updateUploadState((current) => {
        return current ? { ...current, status: 'completed' as const, progress: 100 } : null;
      });
    } catch (error) {
      await cleanupMultipartSessions(activeUploadRef.current);
      const message = error instanceof Error ? error.message : '上传失败';
      updateUploadState((current) => {
        return current ? { ...current, status: 'failed' as const, error: message } : { ...initial, status: 'failed' as const, error: message };
      });
      throw error;
    }
  }, [cleanupMultipartSessions, persist, updateUploadState]);

  const clearUpload = React.useCallback(() => {
    void cleanupMultipartSessions(activeUploadRef.current);
    activeUploadRef.current = null;
    setActiveUpload(null);
  }, [cleanupMultipartSessions]);

  return <UploadContext.Provider value={{ activeUpload, startUpload, clearUpload }}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const value = React.useContext(UploadContext);
  if (!value) throw new Error('useUpload must be used inside UploadProvider');
  return value;
}
