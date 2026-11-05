import { useMemo, useRef } from 'react';
import type { AutocompleteSources } from '../../controllers/use-autocomplete-sources';
import { nextTodoContent, uploadFiles } from '../../controllers/use-content-view';
import { BlockEditor, EditorHandlers } from '../editor/BlockEditor';

interface EmptyBlockProps {
  sources: AutocompleteSources;
  onStart(content: string): void;
}

// An empty page shows one editable bullet; the block is only created once the user types (or presses Enter).
export function EmptyBlock({ sources, onStart }: EmptyBlockProps) {
  const started = useRef(false);
  const handlers = useMemo<EditorHandlers>(() => {
    const noop = () => undefined;
    const start = (content: string) => {
      if (started.current) return;
      started.current = true;
      onStart(content);
    };
    return {
      onChange: (content) => {
        if (content) start(content);
      },
      onSplit: (before, after) => start(before + after),
      onIndent: noop,
      onOutdent: noop,
      onMoveUp: noop,
      onMoveDown: noop,
      onBackspaceAtStart: noop,
      onArrowUpAtTop: noop,
      onArrowDownAtBottom: noop,
      onToggleTodo: (content) => nextTodoContent(content),
      onInsertTemplate: noop,
      onUndo: noop,
      onRedo: noop,
      onSelect: noop,
      onPasteText: () => false,
      onUpload: (files) => uploadFiles(files),
      onBlur: noop,
    };
  }, [onStart]);

  return (
    <div className="block">
      <div className="block-row">
        <span className="block-toggle invisible" />
        <span className="block-bullet">
          <span />
        </span>
        <div className="block-body">
          <BlockEditor initialContent="" caret="start" focusSeq={-1} autoFocus={false} sources={sources} handlers={handlers} />
        </div>
      </div>
    </div>
  );
}
