import { describe, expect, it, vi } from 'vitest';
import { UploadCapacity } from './upload-capacity';

const stats = (used = 20, reserved = 0) => ({ total: 1, total_bytes: used, reserved_bytes: reserved });

describe('upload capacity admission', () => {
  it('counts active and queued groups before admitting another group', async () => {
    const capacity = new UploadCapacity(async () => stats(), vi.fn());
    await capacity.admit(9, 30);
    await expect(capacity.admit(10, 30)).rejects.toMatchObject({ messageKey: 'uploadCapacity.insufficient' });
    await capacity.admit(1, 30);
    expect((await capacity.refresh()).reserved_bytes).toBe(10);
    await expect(capacity.admit(1, 30)).rejects.toThrow();
  });

  it('serializes simultaneous admissions against the same remaining capacity', async () => {
    const capacity = new UploadCapacity(async () => stats(), vi.fn());
    const results = await Promise.allSettled([capacity.admit(9, 30), capacity.admit(10, 30)]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
  });

  it('does not double count registered or just-completed files', async () => {
    let remote = stats();
    const capacity = new UploadCapacity(async () => remote, vi.fn());
    const ticket = await capacity.admit(9, 30);
    capacity.starting(ticket);
    remote = stats(20, 9);
    capacity.registered(ticket);
    await capacity.admit(1, 30);
    expect((await capacity.refresh()).reserved_bytes).toBe(10);
    remote = stats(29, 0);
    expect(await capacity.refresh()).toMatchObject({ total_bytes: 29, reserved_bytes: 1 });
  });

  it('waits for job registration when a server commit precedes its response', async () => {
    let remote = stats();
    const capacity = new UploadCapacity(async () => remote, vi.fn());
    const ticket = await capacity.admit(9, 30);
    capacity.starting(ticket);
    remote = stats(20, 9);
    let settled = false;
    const pending = capacity.admit(1, 30).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    capacity.registered(ticket);
    await pending;
    expect((await capacity.refresh()).reserved_bytes).toBe(10);
  });

  it('preserves server reservations after failure and releases only local reservations', async () => {
    let remote = stats();
    const capacity = new UploadCapacity(async () => remote, vi.fn());
    const ticket = await capacity.admit(9, 30);
    remote = stats(20, 9);
    capacity.release(ticket);
    expect((await capacity.refresh()).reserved_bytes).toBe(9);
    await expect(capacity.admit(10, 30)).rejects.toThrow();
    remote = stats(); // successful server-side deletion
    await expect(capacity.admit(10, 30)).resolves.toBeTypeOf('symbol');
  });

  it('does not reserve original files again when resuming at full capacity', async () => {
    const capacity = new UploadCapacity(async () => stats(20, 10), vi.fn());
    const ticket = await capacity.admit(0, 30);
    capacity.starting(ticket);
    capacity.registered(ticket);
    expect((await capacity.refresh()).reserved_bytes).toBe(10);
  });

  it('fails closed when capacity cannot be verified', async () => {
    const capacity = new UploadCapacity(async () => { throw new Error('offline'); }, vi.fn());
    await expect(capacity.admit(9, 30)).rejects.toThrow('offline');
    const oldBackend = new UploadCapacity(async () => ({ total: 1, total_bytes: 20 } as ReturnType<typeof stats>), vi.fn());
    await expect(oldBackend.admit(9, 30)).rejects.toMatchObject({ messageKey: 'uploadCapacity.unavailable' });
  });
});
