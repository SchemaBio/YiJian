import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadDataFiles: vi.fn(),
  resumeDataFiles: vi.fn(),
  retryDataAsset: vi.fn(),
  deleteUploadJob: vi.fn(),
  abortMultipartUpload: vi.fn(),
  getUploadStorageStats: vi.fn().mockResolvedValue({ total: 1, total_bytes: 20, reserved_bytes: 0, tracked_bytes: 0 }),
}));

vi.mock('@/lib/data-assets', () => ({
  uploadDataFiles: mocks.uploadDataFiles,
  resumeDataFiles: mocks.resumeDataFiles,
  retryDataAsset: mocks.retryDataAsset,
  getUploadStorageStats: mocks.getUploadStorageStats,
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

it('queues successive pairs without replacing an active transfer', async () => {
  window.localStorage.clear();
  let finish!: (value: {cancelledFileIds: string[]}) => void;
  mocks.uploadDataFiles.mockReset().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ cancelledFileIds: [] });
  render(<UploadProvider><Harness /></UploadProvider>);
  fireEvent.click(screen.getByRole('button', {name:'start'}));
  await waitFor(() => expect(mocks.uploadDataFiles).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', {name:'start'}));
  expect(mocks.uploadDataFiles).toHaveBeenCalledTimes(1);
  finish({cancelledFileIds:[]});
  await waitFor(() => expect(mocks.uploadDataFiles).toHaveBeenCalledTimes(2));
});

it('keeps paired retries independent across route content unmounts', async () => {
  window.localStorage.clear();
  const finish: Record<string, () => void> = {};
  mocks.retryDataAsset.mockImplementation((id, _file, progress) => new Promise(resolve => { progress(31); finish[id] = () => resolve({}); }));
  function RetryRoute() {
    const {retryFile, retries} = useUpload();
    return <><button onClick={() => void retryFile('r1', new File(['one'],'R1.fastq'))}>retry1</button><button onClick={() => void retryFile('r2', new File(['two'],'R2.fastq'))}>retry2</button><output data-testid="retries">{JSON.stringify(retries)}</output></>;
  }
  const view = render(<UploadProvider><RetryRoute /></UploadProvider>);
  fireEvent.click(screen.getByText('retry1')); fireEvent.click(screen.getByText('retry2'));
  expect(mocks.retryDataAsset).toHaveBeenCalledTimes(2);
  view.rerender(<UploadProvider><div>another route</div></UploadProvider>);
  finish.r1(); finish.r2();
  view.rerender(<UploadProvider><RetryRoute /></UploadProvider>);
  await waitFor(() => expect(screen.getByTestId('retries')).toHaveTextContent('completed'));
  expect(screen.getByTestId('retries')).toHaveTextContent('"progress":100');
});

it('rejects an oversized second pair before acceptance without disturbing the first transfer', async () => {
  window.localStorage.clear();
  mocks.uploadDataFiles.mockReset();
  const accepted = vi.fn();
  let remoteReserved = 0;
  mocks.getUploadStorageStats.mockImplementation(async () => ({
    total: 1, total_bytes: 20, reserved_bytes: remoteReserved,
  }));
  mocks.uploadDataFiles.mockImplementation(async (...args: Parameters<typeof import('@/lib/data-assets')['uploadDataFiles']>) => {
    remoteReserved = 9;
    args[5]?.onStarted?.([{ fileId: 'quota-r1', jobId: 'quota-job', fileName: 'a.fastq', fileSize: 9, readType: 'read1', progress: 0, status: 'uploading' }]);
    return new Promise(() => {});
  });
  function QuotaHarness() {
    const upload = useUpload();
    const [error, setError] = React.useState('');
    const add = (size: number) => void upload.startUpload({ read1: new File(['x'.repeat(size)], 'a.fastq'), read2: null, internalId: '', uploadPolicyAcknowledged: false, quotaBytes: 30, onAccepted: accepted }).catch(cause => setError(cause.message));
    return <><button onClick={() => add(9)}>add-nine</button><button onClick={() => add(10)}>add-ten</button><output data-testid="quota-error">{error}</output><output data-testid="reserved">{upload.capacity?.reserved_bytes}</output><output data-testid="queue-count">{upload.queuedCount}</output></>;
  }
  const view = render(<UploadProvider><QuotaHarness /></UploadProvider>);
  fireEvent.click(screen.getByText('add-nine'));
  await waitFor(() => expect(mocks.uploadDataFiles).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText('add-ten'));
  await waitFor(() => expect(screen.getByTestId('quota-error')).toHaveTextContent('可用容量不足'));
  expect(accepted).toHaveBeenCalledTimes(1);
  expect(mocks.uploadDataFiles).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('reserved')).toHaveTextContent('9');
  expect(screen.getByTestId('queue-count')).toHaveTextContent('0');
  view.unmount();
});
