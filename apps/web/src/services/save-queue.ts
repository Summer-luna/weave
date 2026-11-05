export type SaveStatus = 'idle' | 'saving' | 'error';

type Listener = (status: SaveStatus, error: Error | null) => void;

export class SaveQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private lastError: Error | null = null;
  private readonly timers = new Map<string, { timer: ReturnType<typeof setTimeout>; task: () => Promise<unknown> }>();
  private readonly listeners = new Set<Listener>();

  run(task: () => Promise<unknown>): Promise<void> {
    this.pending += 1;
    this.emit();
    const next = this.chain.then(async () => {
      try {
        await task();
        this.lastError = null;
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error(String(error));
        console.error(error);
      } finally {
        this.pending -= 1;
        this.emit();
      }
    });
    this.chain = next;
    return next;
  }

  debounce(key: string, delayMs: number, task: () => Promise<unknown>): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.run(task);
    }, delayMs);
    this.timers.set(key, { timer, task });
    this.emit();
  }

  flush(key: string): void {
    const existing = this.timers.get(key);
    if (!existing) return;
    clearTimeout(existing.timer);
    this.timers.delete(key);
    void this.run(existing.task);
  }

  flushAll(): void {
    for (const key of [...this.timers.keys()]) this.flush(key);
  }

  async drain(): Promise<void> {
    this.flushAll();
    await this.chain;
  }

  cancel(key: string): void {
    const existing = this.timers.get(key);
    if (!existing) return;
    clearTimeout(existing.timer);
    this.timers.delete(key);
    this.emit();
  }

  hasPendingWork(): boolean {
    return this.pending > 0 || this.timers.size > 0;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  status(): SaveStatus {
    if (this.hasPendingWork()) return 'saving';
    return this.lastError ? 'error' : 'idle';
  }

  error(): Error | null {
    return this.lastError;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.status(), this.lastError);
  }
}

export const saveQueue = new SaveQueue();
