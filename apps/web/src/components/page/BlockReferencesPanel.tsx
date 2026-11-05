import { useBlockReferencesController } from '../../controllers/use-block-references-controller';
import { ReferenceGroupCard } from './ReferenceGroupCard';

export function BlockReferencesPanel({ blockId, compact = false }: { blockId: string; compact?: boolean }) {
  const query = useBlockReferencesController(blockId);
  const groups = query.data ?? [];
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  if (count === 0) return null;

  return (
    <section className={compact ? 'mt-6 space-y-3' : 'mt-14 space-y-4'}>
      <div className="section-heading">{count} 条块引用</div>
      {groups.map((group) => (
        <ReferenceGroupCard key={group.pageId} group={group} />
      ))}
    </section>
  );
}
