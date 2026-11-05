import { useEffect } from 'react';
import { historyStore } from '../services/history-store';
import { saveQueue } from '../services/save-queue';

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/** Ctrl/Cmd+Z outside any editor still undoes outline changes (block editors handle it themselves). */
export function useHistoryShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.closest?.(EDITABLE)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        saveQueue.flushAll();
        historyStore.undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        historyStore.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
