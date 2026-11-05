import { layoutRepository } from '../repositories/layout-repository';
import type { LayoutState, SidebarItem } from '../types/models';

const MAX_SIDEBAR_ITEMS = 8;
const DEFAULT_STATE: LayoutState = { leftOpen: true, rightOpen: true, aiOpen: false, sidebar: [] };

export class LayoutStore {
  private state: LayoutState = { ...DEFAULT_STATE, ...layoutRepository.load() };
  private readonly listeners = new Set<() => void>();

  snapshot(): LayoutState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  itemKey(item: SidebarItem): string {
    return item.kind === 'page' ? `page:${item.title.toLowerCase()}` : `block:${item.id}`;
  }

  toggleLeft(): void {
    this.set({ leftOpen: !this.state.leftOpen });
  }

  toggleRight(): void {
    this.set({ rightOpen: !this.state.rightOpen });
  }

  setAiOpen(aiOpen: boolean): void {
    this.set(aiOpen ? { aiOpen, rightOpen: true } : { aiOpen });
  }

  open(item: SidebarItem): void {
    const key = this.itemKey(item);
    const rest = this.state.sidebar.filter((existing) => this.itemKey(existing) !== key);
    this.set({ rightOpen: true, sidebar: [item, ...rest].slice(0, MAX_SIDEBAR_ITEMS) });
  }

  close(key: string): void {
    this.set({ sidebar: this.state.sidebar.filter((item) => this.itemKey(item) !== key) });
  }

  closeAll(): void {
    this.set({ sidebar: [] });
  }

  private set(patch: Partial<LayoutState>): void {
    this.state = { ...this.state, ...patch };
    layoutRepository.save(this.state);
    for (const listener of this.listeners) listener();
  }
}

export const layoutStore = new LayoutStore();
