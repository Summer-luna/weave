import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, insertNewline } from '@codemirror/commands';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { AutocompleteSources } from '../../controllers/use-autocomplete-sources';
import type { Caret } from '../../types/models';
import { activeEditorRegistry } from './active-editor-registry';
import { pickFiles, toggleTodo } from './editor-commands';
import { bracketPairing, completionSources, editorTheme, markdownLines, syntaxHighlight, todoShortcut } from './editor-extensions';

export interface EditorHandlers {
  onChange(content: string): void;
  onSplit(before: string, after: string): void;
  onIndent(caret: number): void;
  onOutdent(caret: number): void;
  onMoveUp(caret: number): void;
  onMoveDown(caret: number): void;
  onBackspaceAtStart(): void;
  onArrowUpAtTop(): void;
  onArrowDownAtBottom(): void;
  onToggleTodo(content: string): string;
  onUndo(): void;
  onRedo(): void;
  onSelect(direction: -1 | 1): void;
  onPasteText(text: string): boolean;
  onInsertTemplate(title: string): void;
  onUpload(files: File[]): Promise<string>;
  onBlur(): void;
}

interface BlockEditorProps {
  initialContent: string;
  content?: string;
  caret: Caret;
  focusSeq: number;
  sources: AutocompleteSources;
  handlers: EditorHandlers;
  autoFocus?: boolean;
}

const UPLOADING = '⏳上传中…';

export async function insertUploads(view: EditorView, files: File[], pos: number, handlers: () => EditorHandlers): Promise<void> {
  view.dispatch({ changes: { from: pos, insert: UPLOADING }, selection: { anchor: pos + UPLOADING.length } });
  let markup = '';
  try {
    markup = await handlers().onUpload(files);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '上传失败');
  }
  const at = view.state.doc.toString().indexOf(UPLOADING);
  if (at < 0) return;
  view.dispatch({ changes: { from: at, to: at + UPLOADING.length, insert: markup }, selection: { anchor: at + markup.length } });
}

function sameVisualLine(view: EditorView, a: number, b: number): boolean {
  const first = view.coordsAtPos(a);
  const second = view.coordsAtPos(b);
  if (!first || !second) return view.state.doc.lineAt(a).number === view.state.doc.lineAt(b).number;
  return Math.abs(first.top - second.top) < 4;
}

export function BlockEditor({ initialContent, content, caret, focusSeq, sources, handlers, autoFocus = true }: BlockEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const handlersRef = useRef(handlers);

  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let alive = true;
    const h = () => handlersRef.current;
    const head = (view: EditorView) => view.state.selection.main.head;
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          Prec.high(
            keymap.of([
              {
                key: 'Enter',
                run: (v) => {
                  const { from, to } = v.state.selection.main;
                  const doc = v.state.doc.toString();
                  h().onSplit(doc.slice(0, from), doc.slice(to));
                  return true;
                },
              },
              { key: 'Shift-Enter', run: insertNewline },
              { key: 'Tab', run: (v) => (h().onIndent(head(v)), true) },
              { key: 'Shift-Tab', run: (v) => (h().onOutdent(head(v)), true) },
              { key: 'Alt-Shift-ArrowUp', run: (v) => (h().onMoveUp(head(v)), true) },
              { key: 'Alt-Shift-ArrowDown', run: (v) => (h().onMoveDown(head(v)), true) },
              {
                key: 'Mod-Enter',
                run: (v) => (toggleTodo(v, h()), true),
              },
              {
                key: 'Backspace',
                run: (v) => {
                  const selection = v.state.selection.main;
                  if (!selection.empty || selection.head !== 0) return false;
                  h().onBackspaceAtStart();
                  return true;
                },
              },
              { key: 'Mod-z', run: () => (h().onUndo(), true) },
              { key: 'Mod-Shift-z', run: () => (h().onRedo(), true) },
              { key: 'Mod-y', run: () => (h().onRedo(), true) },
              {
                key: 'Shift-ArrowUp',
                run: (v) => {
                  if (!sameVisualLine(v, head(v), 0)) return false;
                  h().onSelect(-1);
                  return true;
                },
              },
              {
                key: 'Shift-ArrowDown',
                run: (v) => {
                  if (!sameVisualLine(v, head(v), v.state.doc.length)) return false;
                  h().onSelect(1);
                  return true;
                },
              },
              {
                key: 'ArrowUp',
                run: (v) => {
                  if (!sameVisualLine(v, head(v), 0)) return false;
                  h().onArrowUpAtTop();
                  return true;
                },
              },
              {
                key: 'ArrowDown',
                run: (v) => {
                  if (!sameVisualLine(v, head(v), v.state.doc.length)) return false;
                  h().onArrowDownAtBottom();
                  return true;
                },
              },
              { key: 'Escape', run: (v) => (v.contentDOM.blur(), true) },
            ]),
          ),
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          autocompletion({
            override: completionSources(sources, {
              onTemplate: (title) => h().onInsertTemplate(title),
              onAttach: (v, pos) => void pickFiles().then((files) => (files.length ? insertUploads(v, files, pos, h) : undefined)),
            }),
            icons: false,
            activateOnTyping: true,
          }),
          bracketPairing,
          todoShortcut,
          syntaxHighlight,
          markdownLines,
          editorTheme,
          EditorView.updateListener.of((update) => {
            // Mid-composition text is unconfirmed pinyin; report only what the IME commits.
            if (update.docChanged && !update.view.composing) h().onChange(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            paste: (event, v) => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length === 0) {
                const text = event.clipboardData?.getData('text/plain') ?? '';
                if (!text.includes('\n') || !h().onPasteText(text)) return false;
                event.preventDefault();
                return true;
              }
              event.preventDefault();
              void insertUploads(v, files, v.state.selection.main.head, h);
              return true;
            },
            drop: (event, v) => {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (files.length === 0) return false;
              event.preventDefault();
              const pos = v.posAtCoords({ x: event.clientX, y: event.clientY }) ?? v.state.selection.main.head;
              void insertUploads(v, files, pos, h);
              return true;
            },
            compositionend: (_event, v) => {
              setTimeout(() => {
                if (alive && !v.composing) h().onChange(v.state.doc.toString());
              }, 0);
              return false;
            },
            focus: (_event, v) => {
              activeEditorRegistry.activate({ view: v, handlers: h });
              return false;
            },
            blur: (_event, v) => {
              // Reordering keyed siblings moves the DOM node and fires a spurious blur; re-check after the commit.
              setTimeout(() => {
                if (!alive || v.hasFocus) return;
                activeEditorRegistry.release(v);
                h().onBlur();
              }, 0);
              return false;
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      alive = false;
      activeEditorRegistry.release(view);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Undo/redo and AI edits change the block underneath an open editor; mirror them in.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || content === undefined || view.composing) return;
    const doc = view.state.doc.toString();
    if (doc === content) return;
    const anchor = Math.min(view.state.selection.main.head, content.length);
    view.dispatch({ changes: { from: 0, to: doc.length, insert: content }, selection: { anchor } });
  }, [content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !autoFocus) return;
    const length = view.state.doc.length;
    const anchor = caret === 'start' ? 0 : caret === 'end' ? length : Math.min(caret, length);
    view.dispatch({ selection: { anchor } });
    view.focus();
  }, [focusSeq]);

  return <div ref={host} className="block-editor" />;
}
