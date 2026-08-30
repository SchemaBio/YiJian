import { describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  requestPairedUploadJob: vi.fn(),
  startUpload: vi.fn(),
  uploadToCOS: vi.fn(),
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, ...apiMocks };
});

import { uploadDataFiles } from './data-assets';

describe('paired upload cancellation', () => {
  it('cancels only R1 while R2 continues and becomes the remaining progress denominator', async () => {
    const read1 = new File(['r1'], 'sample_R1.fastq');
    const read2 = new File(['r2-data'], 'sample_R2.fastq');
    const read1Controller = new AbortController();
    const read2Controller = new AbortController();
    let resolveRead1Started!: () => void;
    const read1Started = new Promise<void>((resolve) => { resolveRead1Started = resolve; });
    let read2Aborted = false;

    apiMocks.requestPairedUploadJob.mockResolvedValue({
      job_id: 'job-1',
      files: [
        { file_id: 'file-r1', job_id: 'job-1', upload_url: 'https://objects.test/r1', storage_type: 'local', read_type: 'read1' },
        { file_id: 'file-r2', job_id: 'job-1', upload_url: 'https://objects.test/r2', storage_type: 'local', read_type: 'read2' },
      ],
    });
    apiMocks.startUpload.mockResolvedValue(undefined);
    apiMocks.uploadToCOS.mockImplementation(async (_url: string, file: File, onProgress?: (value: number) => void, signal?: AbortSignal) => {
      if (file.name === read1.name) {
        resolveRead1Started();
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')),
            { once: true });
        });
        return;
      }
      read2Aborted = Boolean(signal?.aborted);
      onProgress?.(100);
    });

    const progress: number[] = [];
    const upload = uploadDataFiles(
      read1,
      read2,
      false,
      'sample-1',
      (value) => progress.push(value),
      undefined,
      { read1: read1Controller.signal, read2: read2Controller.signal },
    );
    await read1Started;
    read1Controller.abort();

    await expect(upload).resolves.toEqual({ cancelledFileIds: ['file-r1'] });
    expect(read2Controller.signal.aborted).toBe(false);
    expect(read2Aborted).toBe(false);
    expect(progress.at(-1)).toBe(100);
    expect(apiMocks.requestPairedUploadJob).toHaveBeenCalledWith(
      read1,
      read2,
      false,
      undefined,
      'sample-1',
      expect.objectContaining({ signal: read1Controller.signal }),
    );
  });
});
