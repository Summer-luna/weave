import type { Block, Outline, OutlineNode, OutlineOp, Placement } from '../types/models';

const NEWLINE = '\n';
const LINE_BREAKS = /\r\n?/g;
const TABS = /\t/g;
const NON_SPACE = /\S/;
const LIST_ITEM = /^\s*([-*+]|\d+\.)\s+/;

export interface ParsedBlock {
  content: string;
  children: ParsedBlock[];
}

export class OutlineService {
  build(blocks: Block[]): Outline {
    const nodes: Record<string, OutlineNode> = {};
    for (const block of blocks) {
      nodes[block.id] = {
        id: block.id,
        parentId: block.parentId,
        content: block.content,
        open: block.open,
        refCount: block.refCount,
        childIds: [],
      };
    }
    const rootIds: string[] = [];
    const sorted = [...blocks].sort((a, b) => a.position - b.position);
    for (const block of sorted) {
      const parent = block.parentId ? nodes[block.parentId] : undefined;
      if (parent) parent.childIds.push(block.id);
      else rootIds.push(block.id);
    }
    return { rootIds, nodes };
  }

  children(outline: Outline, parentId: string | null): string[] {
    return parentId === null ? outline.rootIds : (outline.nodes[parentId]?.childIds ?? []);
  }

  placementOf(outline: Outline, id: string): Placement {
    const parentId = outline.nodes[id].parentId;
    return { parentId, index: this.children(outline, parentId).indexOf(id) };
  }

  visibleIds(outline: Outline, rootIds: string[] = outline.rootIds): string[] {
    const result: string[] = [];
    const walk = (ids: string[]) => {
      for (const id of ids) {
        result.push(id);
        const node = outline.nodes[id];
        if (node.open) walk(node.childIds);
      }
    };
    walk(rootIds.filter((id) => outline.nodes[id]));
    return result;
  }

  previousVisible(outline: Outline, id: string, rootIds?: string[]): string | null {
    const ids = this.visibleIds(outline, rootIds);
    const index = ids.indexOf(id);
    return index > 0 ? ids[index - 1] : null;
  }

  nextVisible(outline: Outline, id: string, rootIds?: string[]): string | null {
    const ids = this.visibleIds(outline, rootIds);
    const index = ids.indexOf(id);
    return index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;
  }

  descendantIds(outline: Outline, id: string): string[] {
    const result: string[] = [];
    const walk = (ids: string[]) => {
      for (const child of ids) {
        result.push(child);
        walk(outline.nodes[child].childIds);
      }
    };
    walk(outline.nodes[id]?.childIds ?? []);
    return result;
  }

  insert(outline: Outline, block: { id: string; content: string }, at: Placement): Outline {
    const node: OutlineNode = { id: block.id, parentId: at.parentId, content: block.content, open: true, refCount: 0, childIds: [] };
    const next = this.withChildren({ ...outline, nodes: { ...outline.nodes, [block.id]: node } }, at.parentId, (ids) =>
      this.spliceIn(ids, block.id, at.index),
    );
    return next;
  }

  remove(outline: Outline, id: string): Outline {
    const node = outline.nodes[id];
    if (!node) return outline;
    const nodes = { ...outline.nodes };
    for (const descendant of [id, ...this.descendantIds(outline, id)]) delete nodes[descendant];
    return this.withChildren({ ...outline, nodes }, node.parentId, (ids) => ids.filter((x) => x !== id));
  }

  move(outline: Outline, id: string, to: Placement): Outline {
    const node = outline.nodes[id];
    const detached = this.withChildren(outline, node.parentId, (ids) => ids.filter((x) => x !== id));
    const moved = { ...detached, nodes: { ...detached.nodes, [id]: { ...node, parentId: to.parentId } } };
    return this.withChildren(moved, to.parentId, (ids) => this.spliceIn(ids, id, to.index));
  }

  update(outline: Outline, id: string, patch: Partial<Pick<OutlineNode, 'content' | 'open'>>): Outline {
    const node = outline.nodes[id];
    if (!node) return outline;
    return { ...outline, nodes: { ...outline.nodes, [id]: { ...node, ...patch } } };
  }

  indentTarget(outline: Outline, id: string): Placement | null {
    const { parentId, index } = this.placementOf(outline, id);
    if (index <= 0) return null;
    const newParent = this.children(outline, parentId)[index - 1];
    return { parentId: newParent, index: outline.nodes[newParent].childIds.length };
  }

  outdentTarget(outline: Outline, id: string): Placement | null {
    const parentId = outline.nodes[id].parentId;
    if (parentId === null) return null;
    const parentPlacement = this.placementOf(outline, parentId);
    return { parentId: parentPlacement.parentId, index: parentPlacement.index + 1 };
  }

  moveUpTarget(outline: Outline, id: string): Placement | null {
    const { parentId, index } = this.placementOf(outline, id);
    return index > 0 ? { parentId, index: index - 1 } : null;
  }

  moveDownTarget(outline: Outline, id: string): Placement | null {
    const { parentId, index } = this.placementOf(outline, id);
    return index < this.children(outline, parentId).length - 1 ? { parentId, index: index + 1 } : null;
  }

  splitTarget(outline: Outline, id: string): Placement {
    const node = outline.nodes[id];
    if (node.open && node.childIds.length > 0) return { parentId: id, index: 0 };
    const { parentId, index } = this.placementOf(outline, id);
    return { parentId, index: index + 1 };
  }

  dropTarget(outline: Outline, draggedId: string, targetId: string, position: 'before' | 'after'): Placement | null {
    if (draggedId === targetId || this.descendantIds(outline, draggedId).includes(targetId)) return null;
    const target = this.placementOf(outline, targetId);
    const siblings = this.children(outline, target.parentId).filter((x) => x !== draggedId);
    const index = siblings.indexOf(targetId) + (position === 'after' ? 1 : 0);
    return { parentId: target.parentId, index };
  }

  ancestorIds(outline: Outline, id: string): string[] {
    const chain: string[] = [];
    let current = outline.nodes[id]?.parentId ?? null;
    while (current && outline.nodes[current]) {
      chain.unshift(current);
      current = outline.nodes[current].parentId;
    }
    return chain;
  }

  /** Ops that turn `current` into `target`, plus the resulting outline. Used for undo/redo of any change. */
  transition(current: Outline, target: Outline): { ops: OutlineOp[]; result: Outline } {
    const ops: OutlineOp[] = [];
    let work = current;
    const targetOrder = this.preorder(target, target.rootIds);

    for (const id of targetOrder) {
      if (work.nodes[id]) continue;
      const node = target.nodes[id];
      const at = { parentId: node.parentId, index: this.children(work, node.parentId).length };
      work = this.insert(work, { id, content: node.content }, at);
      work = this.update(work, id, { open: node.open });
      ops.push({ type: 'create', id, content: node.content, open: node.open, at });
    }

    for (const parentId of [null, ...targetOrder]) {
      const wanted = this.children(target, parentId);
      wanted.forEach((childId, index) => {
        const placement = this.placementOf(work, childId);
        if (placement.parentId === parentId && placement.index === index) return;
        work = this.move(work, childId, { parentId, index });
        ops.push({ type: 'move', id: childId, to: { parentId, index } });
      });
    }

    for (const id of this.preorder(work, work.rootIds)) {
      if (target.nodes[id] || !work.nodes[id]) continue;
      work = this.remove(work, id);
      ops.push({ type: 'remove', id });
    }

    for (const id of targetOrder) {
      const want = target.nodes[id];
      const have = work.nodes[id];
      const patch: { content?: string; open?: boolean } = {};
      if (have.content !== want.content) patch.content = want.content;
      if (have.open !== want.open) patch.open = want.open;
      if (patch.content === undefined && patch.open === undefined) continue;
      work = this.update(work, id, patch);
      ops.push({ type: 'update', id, ...patch });
    }
    return { ops, result: work };
  }

  /** Selected ids without those whose ancestor is also selected, in document order. */
  topLevel(outline: Outline, ids: string[]): string[] {
    const selected = new Set(ids);
    const order = this.visibleIds(outline);
    return order.filter((id) => selected.has(id) && !this.ancestorIds(outline, id).some((a) => selected.has(a)));
  }

  rangeBetween(outline: Outline, anchor: string, head: string, rootIds?: string[]): string[] {
    const order = this.visibleIds(outline, rootIds);
    const a = order.indexOf(anchor);
    const b = order.indexOf(head);
    if (a < 0 || b < 0) return [];
    return order.slice(Math.min(a, b), Math.max(a, b) + 1);
  }

  toMarkdown(outline: Outline, ids: string[]): string {
    const lines: string[] = [];
    const walk = (id: string, depth: number) => {
      const node = outline.nodes[id];
      const [first, ...rest] = node.content.split(NEWLINE);
      lines.push(`${"  ".repeat(depth)}- ${first}`);
      for (const line of rest) lines.push(`${"  ".repeat(depth + 1)}${line}`);
      node.childIds.forEach((child) => walk(child, depth + 1));
    };
    ids.forEach((id) => walk(id, 0));
    return lines.join(NEWLINE);
  }

  /** Parses a pasted "- item" outline (2+ lines) into a tree; returns null for ordinary text. */
  parseMarkdownOutline(text: string): ParsedBlock[] | null {
    const lines = text.replace(LINE_BREAKS, NEWLINE).split(NEWLINE).filter((line) => line.trim());
    if (lines.length < 2 || !lines.every((line) => LIST_ITEM.test(line))) return null;
    const roots: ParsedBlock[] = [];
    const stack: { indent: number; block: ParsedBlock }[] = [];
    for (const line of lines) {
      const indent = line.replace(TABS, "  ").search(NON_SPACE);
      const block: ParsedBlock = { content: line.replace(LIST_ITEM, ""), children: [] };
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (stack.length) stack[stack.length - 1].block.children.push(block);
      else roots.push(block);
      stack.push({ indent, block });
    }
    return roots;
  }

  private preorder(outline: Outline, ids: string[]): string[] {
    return ids.flatMap((id) => [id, ...this.preorder(outline, outline.nodes[id]?.childIds ?? [])]);
  }

  private withChildren(outline: Outline, parentId: string | null, change: (ids: string[]) => string[]): Outline {
    if (parentId === null) return { ...outline, rootIds: change(outline.rootIds) };
    const parent = outline.nodes[parentId];
    return { ...outline, nodes: { ...outline.nodes, [parentId]: { ...parent, childIds: change(parent.childIds) } } };
  }

  private spliceIn(ids: string[], id: string, index: number): string[] {
    const next = [...ids];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, id);
    return next;
  }
}

export const outlineService = new OutlineService();
