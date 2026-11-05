import { useSyncExternalStore } from 'react';
import { saveQueue } from '../services/save-queue';

export function useSaveStatus() {
  const status = useSyncExternalStore(
    (listener) => saveQueue.subscribe(listener),
    () => saveQueue.status(),
  );
  return { status, error: status === 'error' ? saveQueue.error() : null };
}
