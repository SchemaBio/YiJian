import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadDataFiles: vi.fn(),
  resumeDataFiles: vi.fn(),
  deleteUploadJob: vi.fn(),
  abortMultipartUpload: vi.fn(),
}));

vi.mock('@/lib/data-assets', () => ({
  uploadDataFiles: mocks.uploadDataFiles,
  resumeDataFiles: mocks.resumeDataFiles,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    deleteUploadJob: mocks.deleteUploadJob,
    abortMultipartUpload: mocks.abortMultipartUpload,
  };
});

import { UploadProvider, useUpload } from './UploadProvider';

let uploadMode: 'single' | 'full' = 'single';
let abortedRead1 = false;
let abortedRead2 = false;

function Harness() {
  const upload = useUpload();
  const state = upload.activeUpload;
  return (
    <>
      <button type="button" onClick={() => void upload.startUpload({
        read1: new File(['r1'], 'sample_R1.fastq'),
        read2: new File(['r2'], 'sample_R2.fastq'),
        uploadPolicyAcknowledged: false,
        internalId: 'sample-1',
      })}>start</button>
      <button type="button" onClick={() => upload.cancelFile('file-r1')}>cancel-r1</button>
      <button type="button" onClick={() => void upload.cancelUpload()}>cancel-job</button>
      <output data-testid="state">{state ? `${state.status}:${state.files.map((file) => `${file.fileId}-${file.status}`).join(',')}` : 'null'}</output>
    </>
  );
}

function installUploadMock() {
  mocks.uploadDataFiles.mockImplementation(async (...args: Parameters<typeof import('@/lib/data-assets')['uploadDataFiles']>) => {
    const callbacks = args[5];
    const signals = args[6];
    callbacks?.onStarted?.([
      { fileId: 'file-r1', jobId: 'job-1', fileName: 'sample_R1.fastq', fileSize: 2, readType: 'read1', progress: 0, status: 'uploading' },
      { fileId: 'file-r2', jobId: 'job-1', fileName: 'sample_R2.fastq', fileSize: 2, readType: 'read2', progress: 0, status: 'uploading' },
    ]);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (cancelledFileIds: string[]) => {
        if (settled) return;
        settled = true;
        resolve({ cancelledFileIds });
      };
      signals?.read1?.addEventListener('abort', () => {
        abortedRead1 = true;
        if (uploadMode === 'single') finish(['file-r1']);
        else finish([]);
      }, { once: true });
      signals?.read2?.addEventListener('abort', () => {
        abortedRead2 = true;
        if (uploadMode === 'full') finish([]);
      }, { once: true });
    });
  });
}

describe('UploadProvider cancellation lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    uploadMode = 'single';
    abortedRead1 = false;
    abortedRead2 = false;
    mocks.deleteUploadJob.mockResolvedValue(undefined);
    mocks.abortMultipartUpload.mockResolvedValue(undefined);
    installUploadMock();
  });

  it('cancels one paired file while allowing its sibling to finish', async () => {
    render(<UploadProvider><Harness /></UploadProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('uploading:file-r1-uploading,file-r2-uploading'));

    fireEvent.click(screen.getByRole('button', { name: 'cancel-r1' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('completed:file-r1-cancelled,file-r2-completed'));
    expect(abortedRead1).toBe(true);
    expect(abortedRead2).toBe(false);
    expect(mocks.deleteUploadJob).not.toHaveBeenCalled();
  });

  it('aborts every file and deletes the upload job exactly once', async () => {
    uploadMode = 'full';
    render(<UploadProvider><Harness /></UploadProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('uploading:file-r1-uploading,file-r2-uploading'));

    fireEvent.click(screen.getByRole('button', { name: 'cancel-job' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel-job' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
    expect(abortedRead1).toBe(true);
    expect(abortedRead2).toBe(true);
    expect(mocks.deleteUploadJob).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUploadJob).toHaveBeenCalledWith('job-1');
  });

  it('removes persisted terminal files and keeps an unfinished recovery record', async () => {
    window.localStorage.setItem('schema:active-upload:v1', JSON.stringify({
      status: 'completed',
      progress: 100,
      read1Name: 'sample_R1.fastq',
      files: [{ fileId: 'done', fileName: 'sample_R1.fastq', readType: 'read1', progress: 100, status: 'completed' }],
    }));
    const first = render(<UploadProvider><Harness /></UploadProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
    expect(window.localStorage.getItem('schema:active-upload:v1')).toBeNull();
    first.unmount();

    window.localStorage.setItem('schema:active-upload:v1', JSON.stringify({
      status: 'failed',
      progress: 10,
      read1Name: 'sample_R1.fastq',
      files: [{ fileId: 'pending', fileName: 'sample_R1.fastq', readType: 'read1', progress: 10, status: 'failed' }],
    }));
    render(<UploadProvider><Harness /></UploadProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('needs_file:pending-failed'));
    expect(window.localStorage.getItem('schema:active-upload:v1')).not.toBeNull();
  });

  it('allows selecting an already-completed pair member while resuming the remaining file', async () => {
    window.localStorage.setItem('schema:active-upload:v1', JSON.stringify({
      status: 'failed',
      progress: 10,
      read1Name: 'sample_R1.fastq',
      read2Name: 'sample_R2.fastq',
      files: [{ fileId: 'pending-r2', jobId: 'job-1', fileName: 'sample_R2.fastq', fileSize: 2, readType: 'read2', progress: 10, status: 'failed' }],
    }));
    mocks.resumeDataFiles.mockResolvedValue({ cancelledFileIds: [] });
    render(<UploadProvider><Harness /></UploadProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('needs_file:pending-r2-failed'));

    fireEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('completed:pending-r2-completed'));
    expect(mocks.resumeDataFiles).toHaveBeenCalledTimes(1);
  });
});
