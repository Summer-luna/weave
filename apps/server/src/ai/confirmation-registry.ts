import { Injectable } from '@nestjs/common';

const CONFIRM_TIMEOUT_MS = 10 * 60_000;

@Injectable()
export class ConfirmationRegistry {
  private readonly pending = new Map<string, (approved: boolean) => void>();

  wait(runId: string, callId: string, signal: AbortSignal): Promise<boolean> {
    const key = `${runId}:${callId}`;
    return new Promise((resolve) => {
      const finish = (approved: boolean) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        this.pending.delete(key);
        resolve(approved);
      };
      const onAbort = () => finish(false);
      const timer = setTimeout(() => finish(false), CONFIRM_TIMEOUT_MS);
      signal.addEventListener('abort', onAbort);
      this.pending.set(key, finish);
    });
  }

  resolve(runId: string, callId: string, approved: boolean): boolean {
    const finish = this.pending.get(`${runId}:${callId}`);
    if (!finish) return false;
    finish(approved);
    return true;
  }
}
