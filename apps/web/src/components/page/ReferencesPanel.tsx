import { ChevronRight, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useReferencesController } from '../../controllers/use-references-controller';
import { ReferenceGroupCard } from './ReferenceGroupCard';

// Rendering thousands of reference cards at once freezes the page on heavily linked hubs.
const GROUP_PAGE_SIZE = 20;

export function ReferencesPanel({ title, compact = false }: { title: string; compact?: boolean }) {
  const { query, linkMention } = useReferencesController(title);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [showLinked, setShowLinked] = useState(!compact);
  const [linkedLimit, setLinkedLimit] = useState(GROUP_PAGE_SIZE);
  const [unlinkedLimit, setUnlinkedLimit] = useState(GROUP_PAGE_SIZE);
  const linked = query.data?.linked ?? [];
  const unlinked = query.data?.unlinked ?? [];
  const linkedCount = linked.reduce((n, g) => n + g.items.length, 0);
  const unlinkedCount = unlinked.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className={compact ? 'mt-6 space-y-3' : 'mt-14 space-y-8'}>
      <div>
        <button type="button" className="section-heading flex items-center gap-1 hover:text-ink" onClick={() => setShowLinked((v) => !v)}>
          <ChevronRight size={14} className={showLinked ? 'rotate-90 transition' : 'transition'} />
          {linkedCount} 条链接引用
        </button>
        {showLinked && linkedCount === 0 && !query.isPending && <p className="text-sm text-muted">还没有页面链接到这里。</p>}
        <div className={showLinked ? 'space-y-4' : 'hidden'}>
          {linked.slice(0, linkedLimit).map((group) => (
            <ReferenceGroupCard key={group.pageId} group={group} />
          ))}
          <MoreButton remaining={linked.length - linkedLimit} onClick={() => setLinkedLimit((n) => n + GROUP_PAGE_SIZE)} />
        </div>
      </div>

      <div>
        <button type="button" className="section-heading flex items-center gap-1 hover:text-ink" onClick={() => setShowUnlinked((v) => !v)}>
          <ChevronRight size={14} className={showUnlinked ? 'rotate-90 transition' : 'transition'} />
          {unlinkedCount} 条未链接提及
        </button>
        {showUnlinked && (
          <div className="space-y-4">
            {unlinked.slice(0, unlinkedLimit).map((group) => (
              <ReferenceGroupCard
                key={group.pageId}
                group={group}
                action={(blockId) => (
                  <button type="button" className="link-mention" onClick={() => void linkMention(blockId, group.pageTitle)}>
                    <Link2 size={13} /> 链接
                  </button>
                )}
              />
            ))}
            <MoreButton remaining={unlinked.length - unlinkedLimit} onClick={() => setUnlinkedLimit((n) => n + GROUP_PAGE_SIZE)} />
          </div>
        )}
      </div>
    </section>
  );
}

export function MoreButton({ remaining, onClick }: { remaining: number; onClick(): void }) {
  if (remaining <= 0) return null;
  return (
    <button type="button" className="chip w-full" onClick={onClick}>
      再显示 {Math.min(remaining, GROUP_PAGE_SIZE)} 个页面（还有 {remaining} 个）
    </button>
  );
}
