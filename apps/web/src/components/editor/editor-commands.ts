import { startCompletion } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import type { EditorHandlers } from './BlockEditor';

export function caretOf(view: EditorView): number {
  return view.state.selection.main.head;
}

export function insertPair(view: EditorView, open: string, close: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${open}${selected}${close}` },
    selection: { anchor: from + open.length, head: from + open.length + selected.length },
    userEvent: 'input.type',
  });
  view.focus();
  if (!selected) startCompletion(view);
}

export function insertText(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, userEvent: 'input.type' });
  view.focus();
  startCompletion(view);
}

export function toggleTodo(view: EditorView, handlers: EditorHandlers): void {
  const doc = view.state.doc.toString();
  const next = handlers.onToggleTodo(doc);
  const anchor = Math.max(0, Math.min(next.length, caretOf(view) + next.length - doc.length));
  view.dispatch({ changes: { from: 0, to: doc.length, insert: next }, selection: { anchor } });
}

export function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
