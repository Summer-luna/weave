import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { copyText } from './copy-text';
import { useAutocompleteSources } from '../../controllers/use-autocomplete-sources';
import type { OutlineActions } from '../../controllers/use-outline-controller';
import type { FocusTarget, Outline } from '../../types/models';
import { BlockItem } from './BlockItem';
import { EmptyBlock } from './EmptyBlock';
import { OutlineContext, OutlineContextValue } from './OutlineContext';
import { OutlineViewStore } from './OutlineViewStore';

interface OutlineViewProps {
  pageTitle: string;
  outline: Outline;
  rootIds: string[];
  zoomed: boolean;
  focus: FocusTarget | null;
  actions: OutlineActions;
  selectedIds?: string[];
}

export function OutlineView({ pageTitle, outline, rootIds, zoomed, focus, actions, selectedIds = [] }: OutlineViewProps) {
  const sources = useAutocompleteSources();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [store] = useState(() => new OutlineViewStore());
  store.sync(outline, focus, selectedIds);
  useLayoutEffect(() => store.flush());
  const hasSelection = selectedIds.length > 0;

  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const handled = () => event.preventDefault();
      if (event.key === 'Escape') {
        handled();
        actions.clearSelection();
      } else if (event.shiftKey && !event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        handled();
        actions.extendSelection(event.key === 'ArrowUp' ? -1 : 1);
      } else if (event.altKey && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        handled();
        actions.moveSelection(event.key === 'ArrowUp' ? -1 : 1);
      } else if (event.key === 'Tab') {
        handled();
        if (event.shiftKey) actions.outdentSelection();
        else actions.indentSelection();
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        handled();
        actions.deleteSelection();
      } else if (mod && (event.key === 'c' || event.key === 'x')) {
        handled();
        copyText(actions.selectionMarkdown());
        if (event.key === 'x') actions.deleteSelection();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        actions.clearSelection();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.shiftKey && target?.closest('.block-row')) return;
      actions.clearSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [hasSelection, actions]);

  const value = useMemo<OutlineContextValue>(
    () => ({ pageTitle, store, actions, sources, dragging: { id: draggingId, set: setDraggingId } }),
    [pageTitle, store, actions, sources, draggingId],
  );

  if (rootIds.length === 0) {
    return (
      <div className="outline-tree">
        <EmptyBlock sources={sources} onStart={(content) => actions.createFirst(content)} />
      </div>
    );
  }

  return (
    <OutlineContext.Provider value={value}>
      <div className={zoomed ? 'outline-tree zoomed' : 'outline-tree'}>
        {rootIds.map((id) => (
          <BlockItem key={id} id={id} />
        ))}
      </div>
    </OutlineContext.Provider>
  );
}
