import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DragEvent, memo, MouseEvent, useMemo, useState, useSyncExternalStore } from 'react';
import { useLayoutController } from '../../controllers/use-layout-controller';
import { nextTodoContent, uploadFiles } from '../../controllers/use-content-view';
import type { DropPosition } from '../../controllers/use-outline-controller';
import { RichContent } from '../content/RichContent';
import { BlockEditor, EditorHandlers } from '../editor/BlockEditor';
import { useOutlineContext } from './OutlineContext';

const DRAG_TYPE = 'application/x-weave-block';

export const BlockItem = memo(function BlockItem({ id }: { id: string }) {
  const { pageTitle, store, actions, sources, dragging } = useOutlineContext();
  const navigate = useNavigate();
  const layout = useLayoutController();
  const subscribe = useMemo(() => (listener: () => void) => store.subscribe(id, listener), [store, id]);
  const node = useSyncExternalStore(subscribe, () => store.node(id));
  const focus = useSyncExternalStore(subscribe, () => store.focusFor(id));
  const selected = useSyncExternalStore(subscribe, () => store.isSelected(id));
  const [dropAt, setDropAt] = useState<DropPosition | null>(null);
  const focused = focus !== null;

  const handlers = useMemo<EditorHandlers>(
    () => ({
      onChange: (content) => actions.changeContent(id, content),
      onSplit: (before, after) => actions.split(id, before, after),
      onIndent: (caret) => actions.indent(id, caret),
      onOutdent: (caret) => actions.outdent(id, caret),
      onMoveUp: (caret) => actions.moveUp(id, caret),
      onMoveDown: (caret) => actions.moveDown(id, caret),
      onBackspaceAtStart: () => actions.backspaceAtStart(id),
      onArrowUpAtTop: () => actions.focusPrevious(id),
      onArrowDownAtBottom: () => actions.focusNext(id),
      onToggleTodo: (content) => nextTodoContent(content),
      onInsertTemplate: (title) => void actions.insertTemplate(id, title),
      onUpload: (files) => uploadFiles(files),
      onUndo: () => actions.undo(),
      onRedo: () => actions.redo(),
      onSelect: (direction) => actions.startSelection(id, direction),
      onPasteText: (text) => actions.pasteOutline(id, text),
      onBlur: () => actions.blur(id),
    }),
    [actions, id],
  );

  if (!node) return null;
  const hasChildren = node.childIds.length > 0;

  const onBulletClick = (event: MouseEvent) => {
    if (event.shiftKey) layout.openInSidebar({ kind: 'block', id });
    else void navigate({ to: '/page/$title', params: { title: pageTitle }, search: { zoom: id } });
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!dragging.id || dragging.id === id) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData(DRAG_TYPE) || dragging.id;
    if (dragged && dropAt) actions.drop(dragged, id, dropAt);
    setDropAt(null);
    dragging.set(null);
  };

  return (
    <div className="block">
      <div
        className={clsx('block-row', selected && 'selected', dropAt === 'before' && 'drop-before', dropAt === 'after' && 'drop-after')}
        onDragOver={onDragOver}
        onDragLeave={() => setDropAt(null)}
        onDrop={onDrop}
      >
        <button
          type="button"
          className={clsx('block-toggle', !hasChildren && 'invisible', node.open && 'rotate-90')}
          onClick={() => actions.toggleOpen(id)}
          tabIndex={-1}
          aria-label={node.open ? '折叠' : '展开'}
        >
          <ChevronRight size={14} />
        </button>
        <span
          className={clsx('block-bullet', hasChildren && !node.open && 'collapsed')}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_TYPE, id);
            event.dataTransfer.effectAllowed = 'move';
            dragging.set(id);
          }}
          onDragEnd={() => dragging.set(null)}
          onClick={onBulletClick}
          title="点击聚焦，Shift+点击在右侧打开，拖动可移动"
        >
          <span />
        </span>
        <div className="block-body">
          {focus && focused ? (
            <BlockEditor initialContent={node.content} content={node.content} caret={focus.caret} focusSeq={focus.seq} sources={sources} handlers={handlers} />
          ) : (
            <div
              className="block-content"
              onClick={(event) => (event.shiftKey ? actions.selectTo(id) : actions.focusOn(id, 'end'))}
            >
              {node.content ? (
                <RichContent content={node.content} onToggleTodo={() => actions.toggleTodo(id)} onToggleTask={(line) => actions.toggleTask(id, line)} />
              ) : (
                <span className="placeholder">&nbsp;</span>
              )}
            </div>
          )}
        </div>
        {node.refCount > 0 && (
          <button type="button" className="ref-count" title={`被引用 ${node.refCount} 次，点击查看引用`} onClick={onBulletClick}>
            {node.refCount}
          </button>
        )}
      </div>
      {hasChildren && node.open && (
        <div className="block-children">
          {node.childIds.map((child) => (
            <BlockItem key={child} id={child} />
          ))}
        </div>
      )}
    </div>
  );
});
