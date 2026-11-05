import type { FocusTarget, Outline, OutlineNode } from '../../types/models';

type Listener = () => void;

// Lets each block subscribe to its own node so a keystroke re-renders one block instead of the whole page.
export class OutlineViewStore {
  private outline: Outline = { rootIds: [], nodes: {} };
  private focus: FocusTarget | null = null;
  private selected = new Set<string>();
  private changed = new Set<string>();
  private readonly listeners = new Map<string, Set<Listener>>();

  sync(outline: Outline, focus: FocusTarget | null, selectedIds: string[] = []): void {
    const selected = new Set(selectedIds);
    for (const id of selected) if (!this.selected.has(id)) this.changed.add(id);
    for (const id of this.selected) if (!selected.has(id)) this.changed.add(id);
    this.selected = selected;
    if (outline !== this.outline) {
      for (const [id, node] of Object.entries(outline.nodes)) if (this.outline.nodes[id] !== node) this.changed.add(id);
      for (const id of Object.keys(this.outline.nodes)) if (!outline.nodes[id]) this.changed.add(id);
      this.outline = outline;
    }
    if (focus !== this.focus) {
      if (this.focus) this.changed.add(this.focus.id);
      if (focus) this.changed.add(focus.id);
      this.focus = focus;
    }
  }

  flush(): void {
    const ids = [...this.changed];
    this.changed.clear();
    for (const id of ids) for (const listener of this.listeners.get(id) ?? []) listener();
  }

  subscribe(id: string, listener: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  }

  node(id: string): OutlineNode | undefined {
    return this.outline.nodes[id];
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  focusFor(id: string): FocusTarget | null {
    return this.focus?.id === id ? this.focus : null;
  }
}
