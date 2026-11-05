import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { blockService } from '../services/block-service';
import { contentTokenizer } from '../services/content-tokenizer';
import { markdownBlockParser } from '../services/markdown-block-parser';
import { historyStore } from '../services/history-store';
import { outlineService, ParsedBlock } from '../services/outline-service';
import { pageService } from '../services/page-service';
import { saveQueue } from '../services/save-queue';
import type { Caret, FocusTarget, Outline, PageState, Placement } from '../types/models';
import { queryKeys } from './query-keys';

export type DropPosition = 'before' | 'after';

export interface OutlineActions {
  focusOn(id: string, caret: Caret): void;
  blur(id: string): void;
  changeContent(id: string, content: string): void;
  createFirst(content?: string): void;
  split(id: string, before: string, after: string): void;
  indent(id: string, caret: number): void;
  outdent(id: string, caret: number): void;
  moveUp(id: string, caret: number): void;
  moveDown(id: string, caret: number): void;
  drop(draggedId: string, targetId: string, position: DropPosition): void;
  backspaceAtStart(id: string): void;
  focusPrevious(id: string): void;
  focusNext(id: string): void;
  toggleOpen(id: string): void;
  toggleTodo(id: string): void;
  toggleTask(id: string, line: number): void;
  insertTemplate(id: string, templateTitle: string): Promise<void>;
  pasteOutline(id: string, text: string): boolean;
  undo(): void;
  redo(): void;
  startSelection(id: string, direction: -1 | 1): void;
  selectTo(id: string): void;
  extendSelection(direction: -1 | 1): void;
  clearSelection(): void;
  indentSelection(): void;
  outdentSelection(): void;
  moveSelection(direction: -1 | 1): void;
  deleteSelection(): void;
  selectionMarkdown(): string;
}

export interface OutlineSelection {
  anchor: string;
  head: string;
}

const CONTENT_DEBOUNCE_MS = 400;

export function useOutlineController(title: string, zoomId?: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => queryKeys.page(title), [title]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => pageService.loadState(title),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnMount: () => (saveQueue.hasPendingWork() ? false : 'always'),
    refetchOnWindowFocus: false,
  });
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [selection, setSelection] = useState<OutlineSelection | null>(null);
  const seq = useRef(0);
  const selectionRef = useRef<OutlineSelection | null>(null);
  selectionRef.current = selection;
  const focusIdRef = useRef<string | null>(null);
  focusIdRef.current = focus?.id ?? null;

  const actions = useMemo<OutlineActions>(() => {
    const read = () => queryClient.getQueryData<PageState>(key);
    const outline = (): Outline => read()?.outline ?? { rootIds: [], nodes: {} };
    const write = (next: Outline) =>
      queryClient.setQueryData<PageState>(key, (prev) => (prev ? { ...prev, outline: next } : prev));
    // Every local change goes through commit, so every change is undoable.
    const commit = (next: Outline, mergeKey?: string) => {
      const before = outline();
      write(next);
      if (before !== next) historyStore.record({ before, after: next, mergeKey, apply: applyTarget });
    };
    const contentKey = (id: string) => `content:${id}`;
    const scope = () => (zoomId && outline().nodes[zoomId] ? [zoomId] : undefined);

    let resolvedPageId: string | null = null;
    const ensurePageId = async (): Promise<string> => {
      const state = read();
      if (state?.pageId) return state.pageId;
      if (resolvedPageId) return resolvedPageId;
      const page = await pageService.ensure(state?.title ?? title);
      resolvedPageId = page.id;
      queryClient.setQueryData<PageState>(key, (prev) => (prev ? { ...prev, pageId: page.id, title: page.title } : prev));
      void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
      return page.id;
    };

    const afterLinksChanged = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.blockRefRoot });
    };

    const saveContent = (id: string, content: string, delay = CONTENT_DEBOUNCE_MS) =>
      saveQueue.debounce(contentKey(id), delay, async () => {
        await blockService.updateContent(id, content);
        afterLinksChanged();
      });

    const createRemote = (id: string, at: Placement, content: string) =>
      saveQueue.run(async () => {
        const pageId = await ensurePageId();
        await blockService.create({ id, pageId, parentId: at.parentId, index: at.index, content });
        if (content) afterLinksChanged();
      });

    const moveRemote = (id: string, to: Placement) =>
      saveQueue.run(() => blockService.move(id, { parentId: to.parentId, index: to.index }));

    const openRemote = (id: string, open: boolean) => saveQueue.run(() => blockService.setOpen(id, open));

    // Only deliberate deletions go to the trash; merges and undo steps would just fill it with noise.
    const deleteRemote = (o: Outline, id: string, trash = false) => {
      for (const removed of [id, ...outlineService.descendantIds(o, id)]) saveQueue.cancel(contentKey(removed));
      void saveQueue.run(async () => {
        await blockService.delete(id, trash);
        afterLinksChanged();
      });
    };

    const focusOn = (id: string, caret: Caret) => {
      setSelection(null);
      setFocus({ id, caret, seq: ++seq.current });
    };

    function applyTarget(target: Outline, options: { trash?: boolean } = {}) {
      const current = outline();
      const { ops, result } = outlineService.transition(current, target);
      if (ops.length === 0) return;
      write(result);
      for (const op of ops) {
        if (op.type === 'create') {
          void createRemote(op.id, op.at, op.content);
          if (!op.open) void openRemote(op.id, false);
        } else if (op.type === 'move') void moveRemote(op.id, op.to);
        else if (op.type === 'remove') deleteRemote(current, op.id, options.trash);
        else {
          if (op.content !== undefined) saveContent(op.id, op.content, 0);
          if (op.open !== undefined) void openRemote(op.id, op.open);
        }
      }
      setFocus((f) => (f && !result.nodes[f.id] ? null : f));
    }

    // Bulk edits are computed as a whole new outline, then synced through the same path as undo.
    const change = (next: Outline, options: { trash?: boolean } = {}) => {
      const before = outline();
      applyTarget(next, options);
      historyStore.record({ before, after: next, apply: applyTarget });
    };

    const selectedTopLevel = (): string[] => {
      const sel = selectionRef.current;
      if (!sel) return [];
      const o = outline();
      return outlineService.topLevel(o, outlineService.rangeBetween(o, sel.anchor, sel.head, scope()));
    };

    const insertParsed = (o: Outline, blocks: ParsedBlock[], at: Placement): { outline: Outline; lastId: string | null } => {
      let work = o;
      let lastId: string | null = null;
      const add = (block: ParsedBlock, placement: Placement) => {
        const id = blockService.newId();
        lastId = id;
        work = outlineService.insert(work, { id, content: block.content }, placement);
        block.children.forEach((child, i) => add(child, { parentId: id, index: i }));
      };
      blocks.forEach((block, i) => add(block, { parentId: at.parentId, index: at.index + i }));
      return { outline: work, lastId };
    };

    const relocate = (id: string, to: Placement | null, caret?: number) => {
      if (!to) return;
      const o = outline();
      let next = outlineService.move(o, id, to);
      if (to.parentId && !o.nodes[to.parentId].open) {
        next = outlineService.update(next, to.parentId, { open: true });
        void openRemote(to.parentId, true);
      }
      commit(next);
      void moveRemote(id, to);
      if (caret !== undefined) focusOn(id, caret);
    };

    return {
      focusOn,

      blur(id) {
        setFocus((current) => (current?.id === id ? null : current));
        saveQueue.flush(contentKey(id));
      },

      changeContent(id, content) {
        const o = outline();
        if (!o.nodes[id] || o.nodes[id].content === content) return;
        commit(outlineService.update(o, id, { content }), contentKey(id));
        saveContent(id, content);
      },

      createFirst(content = '') {
        const o = outline();
        const id = blockService.newId();
        const at = { parentId: null, index: o.rootIds.length };
        commit(outlineService.insert(o, { id, content }, at));
        void createRemote(id, at, content);
        focusOn(id, 'end');
      },

      split(id, before, after) {
        const o = outline();
        const node = o.nodes[id];
        if (!node) return;
        const newId = blockService.newId();
        if (id === zoomId) {
          const at = { parentId: id, index: 0 };
          let next = outlineService.update(o, id, { content: before, open: true });
          next = outlineService.insert(next, { id: newId, content: after }, at);
          commit(next);
          saveContent(id, before, 0);
          if (!node.open) void openRemote(id, true);
          void createRemote(newId, at, after);
          focusOn(newId, 0);
          return;
        }
        if (before === '' && after !== '') {
          const at = outlineService.placementOf(o, id);
          commit(outlineService.insert(o, { id: newId, content: '' }, at));
          void createRemote(newId, at, '');
          focusOn(id, 0);
          return;
        }
        const at = outlineService.splitTarget(o, id);
        let next = outlineService.update(o, id, { content: before });
        next = outlineService.insert(next, { id: newId, content: after }, at);
        commit(next);
        saveContent(id, before, 0);
        void createRemote(newId, at, after);
        focusOn(newId, 0);
      },

      indent(id, caret) {
        relocate(id, outlineService.indentTarget(outline(), id), caret);
      },

      outdent(id, caret) {
        relocate(id, outlineService.outdentTarget(outline(), id), caret);
      },

      moveUp(id, caret) {
        relocate(id, outlineService.moveUpTarget(outline(), id), caret);
      },

      moveDown(id, caret) {
        relocate(id, outlineService.moveDownTarget(outline(), id), caret);
      },

      drop(draggedId, targetId, position) {
        relocate(draggedId, outlineService.dropTarget(outline(), draggedId, targetId, position));
      },

      backspaceAtStart(id) {
        const o = outline();
        const node = o.nodes[id];
        if (!node || node.childIds.length > 0) return;
        const prevId = outlineService.previousVisible(o, id, scope());
        if (!prevId) return;
        const prev = o.nodes[prevId];
        const merged = prev.content + node.content;
        let next = outlineService.update(o, prevId, { content: merged });
        next = outlineService.remove(next, id);
        commit(next);
        if (node.content) saveContent(prevId, merged, 0);
        deleteRemote(o, id);
        focusOn(prevId, prev.content.length);
      },

      focusPrevious(id) {
        const prevId = outlineService.previousVisible(outline(), id, scope());
        if (prevId) focusOn(prevId, 'end');
      },

      focusNext(id) {
        const nextId = outlineService.nextVisible(outline(), id, scope());
        if (nextId) focusOn(nextId, 'start');
      },

      toggleOpen(id) {
        const o = outline();
        const node = o.nodes[id];
        if (!node || node.childIds.length === 0) return;
        commit(outlineService.update(o, id, { open: !node.open }));
        void openRemote(id, !node.open);
      },

      async insertTemplate(id, templateTitle) {
        const template = await queryClient.fetchQuery({
          queryKey: queryKeys.page(templateTitle),
          queryFn: () => pageService.loadState(templateTitle),
          staleTime: 5_000,
        });
        const source = template.outline;
        if (source.rootIds.length === 0) return;
        let o = outline();
        const current = o.nodes[id];
        if (!current) return;
        const at = outlineService.placementOf(o, id);
        const replaceCurrent = current.content.trim() === '' && current.childIds.length === 0;
        if (replaceCurrent) {
          deleteRemote(o, id);
          o = outlineService.remove(o, id);
        }
        let firstId: string | null = null;
        const clone = (sourceId: string, parentId: string | null, index: number) => {
          const node = source.nodes[sourceId];
          const newId = blockService.newId();
          firstId ??= newId;
          const placement = { parentId, index };
          o = outlineService.insert(o, { id: newId, content: node.content }, placement);
          void createRemote(newId, placement, node.content);
          node.childIds.forEach((child, i) => clone(child, newId, i));
        };
        const start = replaceCurrent ? at.index : at.index + 1;
        source.rootIds.forEach((rootId, i) => clone(rootId, at.parentId, start + i));
        commit(o);
        if (firstId) focusOn(firstId, 'end');
      },

      pasteOutline(id, text) {
        const parsed = outlineService.parseMarkdownOutline(text);
        if (!parsed) return false;
        let o = outline();
        const node = o.nodes[id];
        if (!node) return false;
        const at = outlineService.placementOf(o, id);
        const replace = node.content.trim() === '' && node.childIds.length === 0;
        if (replace) o = outlineService.remove(o, id);
        const { outline: next, lastId } = insertParsed(o, parsed, replace ? at : { parentId: at.parentId, index: at.index + 1 });
        change(next);
        if (lastId) focusOn(lastId, 'end');
        return true;
      },

      undo() {
        saveQueue.flushAll();
        historyStore.undo();
      },

      redo() {
        historyStore.redo();
      },

      startSelection(id, direction) {
        const o = outline();
        const neighbour = direction < 0 ? outlineService.previousVisible(o, id, scope()) : outlineService.nextVisible(o, id, scope());
        setFocus(null);
        setSelection({ anchor: id, head: neighbour ?? id });
      },

      selectTo(id) {
        const anchor = selectionRef.current?.anchor ?? focusIdRef.current ?? id;
        setFocus(null);
        setSelection({ anchor, head: id });
      },

      extendSelection(direction) {
        const sel = selectionRef.current;
        if (!sel) return;
        const o = outline();
        const next = direction < 0 ? outlineService.previousVisible(o, sel.head, scope()) : outlineService.nextVisible(o, sel.head, scope());
        if (next) setSelection({ ...sel, head: next });
      },

      clearSelection() {
        setSelection(null);
      },

      indentSelection() {
        let o = outline();
        for (const id of selectedTopLevel()) {
          const to = outlineService.indentTarget(o, id);
          if (!to) return;
          o = outlineService.move(o, id, to);
          if (to.parentId && !o.nodes[to.parentId].open) o = outlineService.update(o, to.parentId, { open: true });
        }
        change(o);
      },

      outdentSelection() {
        let o = outline();
        for (const id of [...selectedTopLevel()].reverse()) {
          const to = outlineService.outdentTarget(o, id);
          if (!to) return;
          o = outlineService.move(o, id, to);
        }
        change(o);
      },

      moveSelection(direction) {
        let o = outline();
        const ids = selectedTopLevel();
        for (const id of direction < 0 ? ids : [...ids].reverse()) {
          const to = direction < 0 ? outlineService.moveUpTarget(o, id) : outlineService.moveDownTarget(o, id);
          if (!to) return;
          o = outlineService.move(o, id, to);
        }
        change(o);
      },

      deleteSelection() {
        const ids = selectedTopLevel();
        if (ids.length === 0) return;
        const o = outline();
        const fallback = outlineService.previousVisible(o, ids[0], scope());
        let next = o;
        for (const id of ids) next = outlineService.remove(next, id);
        setSelection(null);
        change(next, { trash: true });
        if (fallback && next.nodes[fallback]) focusOn(fallback, 'end');
      },

      selectionMarkdown() {
        return outlineService.toMarkdown(outline(), selectedTopLevel());
      },

      toggleTodo(id) {
        const o = outline();
        const node = o.nodes[id];
        if (!node) return;
        const content = contentTokenizer.toggleTodo(node.content);
        commit(outlineService.update(o, id, { content }));
        saveContent(id, content, 0);
      },

      toggleTask(id, line) {
        const o = outline();
        const node = o.nodes[id];
        if (!node) return;
        const content = markdownBlockParser.toggleTask(node.content, line);
        if (content === node.content) return;
        commit(outlineService.update(o, id, { content }));
        saveContent(id, content, 0);
      },
    };
  }, [queryClient, key, title, zoomId]);

  useEffect(() => {
    setFocus(null);
    setSelection(null);
    return () => saveQueue.flushAll();
  }, [key]);

  const selectedIds = useMemo(() => {
    const outline = query.data?.outline;
    if (!selection || !outline) return [];
    const scopeIds = zoomId && outline.nodes[zoomId] ? [zoomId] : undefined;
    return outlineService.rangeBetween(outline, selection.anchor, selection.head, scopeIds);
  }, [selection, query.data?.outline, zoomId]);

  const zoomPath = useMemo(() => {
    const outline = query.data?.outline;
    if (!zoomId || !outline?.nodes[zoomId]) return [];
    return outlineService.ancestorIds(outline, zoomId).map((id) => ({ id, content: outline.nodes[id].content }));
  }, [query.data?.outline, zoomId]);

  return { query, state: query.data, focus, actions, zoomPath, selectedIds };
}
