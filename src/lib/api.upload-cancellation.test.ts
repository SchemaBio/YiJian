import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUploadCancelled, uploadPartToCOS, uploadToCOS } from './api';

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  abortCalls = 0;
  sent = false;
  private readonly responseHeaders = new Map<string, string>([['ETag', '"etag-1"']]);

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open() {}

  setRequestHeader() {}

  getResponseHeader(name: string) {
    return this.responseHeaders.get(name) ?? null;
  }

  send() {
    this.sent = true;
  }

  abort() {
    this.abortCalls += 1;
    this.onabort?.();
  }
}

describe('abortable COS uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockXMLHttpRequest.instances = [];
  });

  it('aborts an ordinary XHR immediately and reports a user cancellation', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    const controller = new AbortController();
    const promise = uploadToCOS(
      'https://objects.example.test/upload/object',
      new File(['payload'], 'sample.fastq'),
      undefined,
      controller.signal,
    );

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    controller.abort();

    const error = await promise.catch((reason: unknown) => reason);
    expect(isUploadCancelled(error)).toBe(true);
    expect(MockXMLHttpRequest.instances[0].abortCalls).toBe(1);
    expect(MockXMLHttpRequest.instances[0].sent).toBe(true);
  });

  it('aborts a multipart-part XHR without exposing a retryable network error', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    const controller = new AbortController();
    const promise = uploadPartToCOS(
      'https://objects.example.test/upload/part-1',
      new Blob(['part']),
      undefined,
      controller.signal,
    );

    controller.abort();

    const error = await promise.catch((reason: unknown) => reason);
    expect(isUploadCancelled(error)).toBe(true);
    expect(MockXMLHttpRequest.instances[0].abortCalls).toBe(1);
  });
});
