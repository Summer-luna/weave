import { useNavigate } from '@tanstack/react-router';
import { useBlockRef } from '../../controllers/use-block-ref';
import { useLayoutController } from '../../controllers/use-layout-controller';
import { RichContent } from './RichContent';

const MAX_DEPTH = 3;

export function BlockRefInline({ id, depth }: { id: string; depth: number }) {
  const { data, isPending } = useBlockRef(id);
  const navigate = useNavigate();
  const layout = useLayoutController();

  if (isPending) return <span className="block-ref text-muted">…</span>;
  if (!data) return <span className="block-ref block-ref-missing">(({id}))</span>;

  return (
    <span
      className="block-ref"
      title={`来自「${data.pageTitle}」，点击跳转，Shift+点击在右侧打开`}
      onClick={(event) => {
        event.stopPropagation();
        if (event.shiftKey) layout.openInSidebar({ kind: 'block', id });
        else void navigate({ to: '/page/$title', params: { title: data.pageTitle }, search: { zoom: id } });
      }}
    >
      {depth >= MAX_DEPTH ? data.content : <RichContent content={data.content} depth={depth + 1} />}
    </span>
  );
}
