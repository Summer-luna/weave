import type { EditorView } from '@codemirror/view';
import type { EditorHandlers } from './BlockEditor';

export interface ActiveEditor {
  view: EditorView;
  handlers(): EditorHandlers;
}

export class ActiveEditorRegistry {
  private current: ActiveEditor | null = null;
  private readonly listeners = new Set<() => void>();

  snapshot(): ActiveEditor | null {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  activate(editor: ActiveEditor): void {
    if (this.current?.view === editor.view) return;
    this.current = editor;
    this.emit();
  }

  release(view: EditorView): void {
    if (this.current?.view !== view) return;
    this.current = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const activeEditorRegistry = new ActiveEditorRegistry();
