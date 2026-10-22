import { LocalizedError } from '@/i18n/errors';
import type { UploadStorageStats } from './data-assets';

/** Browser-only reservations supplement the server's inventory until a queued
 * group gets its upload job. Once registered, the server owns its reservation. */
export class UploadCapacity {
  private tickets = new Map<symbol, { bytes: number; registered: boolean }>();
  private creating = new Map<symbol, { done: Promise<void>; resolve: () => void }>();
  private version = 0;
  private admission: Promise<unknown> = Promise.resolve();
  private request = 0;
  private published = 0;
  private snapshot: UploadStorageStats | null = null;

  constructor(
    private load: () => Promise<UploadStorageStats>,
    private changed: (stats: UploadStorageStats) => void,
  ) {}

  async refresh(): Promise<UploadStorageStats> {
    for (;;) {
      // Do not mix a snapshot taken after job commit with local bytes whose
      // IDs have not returned yet. That brief window would double-count them.
      while (this.creating.size) await Promise.all([...this.creating.values()].map(item => item.done));
      const version = this.version;
      const request = ++this.request;
      const tickets = [...this.tickets.values()];
      const stats = await this.load();
      if (version !== this.version) continue;
      // Refuse admission against an older backend that cannot report reserved
      // bytes; silently treating them as zero would defeat the quota check.
      if (!Number.isFinite(stats.reserved_bytes)) {
        throw new LocalizedError('uploadCapacity.unavailable');
      }
      const localBytes = tickets.reduce((sum, ticket) => sum + (ticket.registered ? 0 : ticket.bytes), 0);
      const result = { ...stats, reserved_bytes: stats.reserved_bytes + localBytes };
      if (request >= this.published) {
        this.published = request;
        this.snapshot = result;
        this.changed(result);
      }
      return result;
    }
  }

  admit(bytes: number, quota: number): Promise<symbol> {
    const pending = this.admission.catch(() => undefined).then(async () => {
      const stats = await this.refresh();
      if (bytes > Math.max(0, quota - stats.total_bytes - stats.reserved_bytes)) {
        throw new LocalizedError('uploadCapacity.insufficient');
      }
      const ticket = Symbol('upload');
      this.tickets.set(ticket, { bytes, registered: false });
      this.version++;
      this.snapshot = { ...stats, reserved_bytes: stats.reserved_bytes + bytes };
      this.changed(this.snapshot);
      return ticket;
    });
    this.admission = pending;
    return pending;
  }

  registered(ticket: symbol) {
    this.creating.get(ticket)?.resolve();
    this.creating.delete(ticket);
    const entry = this.tickets.get(ticket);
    if (!entry) return;
    entry.registered = true;
    this.version++;
    void this.refresh().catch(() => undefined);
  }

  release(ticket: symbol) {
    this.creating.get(ticket)?.resolve();
    this.creating.delete(ticket);
    this.tickets.delete(ticket);
    this.version++;
    // Server reservations survive failed transfers; refresh rather than
    // subtracting blindly from the last published total.
    void this.refresh().catch(() => undefined);
  }

  starting(ticket: symbol) {
    let resolve!: () => void;
    const done = new Promise<void>(finish => { resolve = finish; });
    this.creating.set(ticket, { done, resolve });
    this.version++;
  }
}
