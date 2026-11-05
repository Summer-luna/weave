import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { useOutlineController } from '../../controllers/use-outline-controller';
import { usePageTitleController } from '../../controllers/use-page-title-controller';
import { useAiPageActions } from '../../controllers/use-ai-chat-controller';
import { useStarController } from '../../controllers/use-star-controller';
import { OutlineView } from '../outline/OutlineView';
import { BlockReferencesPanel } from './BlockReferencesPanel';
import { PageTitle } from './PageTitle';
import { ReferencesPanel } from './ReferencesPanel';
import { ZoomBreadcrumbs } from './ZoomBreadcrumbs';

export type PageVariant = 'main' | 'stream' | 'sidebar';

interface PageViewProps {
  title: string;
  zoomId?: string;
  variant?: PageVariant;
}

export function PageView({ title, zoomId, variant = 'main' }: PageViewProps) {
  const { query, state, focus, actions, zoomPath, selectedIds } = useOutlineController(title, zoomId);
  const titleController = usePageTitleController(state);
  const star = useStarController(state);
  const ai = useAiPageActions();

  if (query.isPending) return <div className="py-6 text-muted">加载中…</div>;
  if (query.isError || !state) {
    return (
      <div className="space-y-3 py-6">
        <p className="text-danger">加载失败：{query.error instanceof Error ? query.error.message : '未知错误'}</p>
        <button type="button" className="chip" onClick={() => void query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? '重试中…' : '重试'}
        </button>
      </div>
    );
  }

  const zoomed = zoomId && state.outline.nodes[zoomId] ? zoomId : undefined;
  const editableTitle = variant === 'main' && !zoomed;

  return (
    <article className={clsx(variant === 'stream' && 'daily-entry', variant === 'sidebar' && 'text-[15px]')}>
      {zoomId && !zoomed && <p className="mb-4 text-sm text-danger">要聚焦的块不存在，可能已被删除。</p>}
      {zoomed ? (
        <ZoomBreadcrumbs pageTitle={state.title} path={zoomPath} />
      ) : editableTitle ? (
        <PageTitle
          title={state.title}
          error={titleController.error}
          busy={titleController.busy}
          onRename={titleController.rename}
          starred={star.starred}
          onToggleStar={() => void star.toggle()}
          onAiOrganize={() => ai.organize(state.title)}
        />
      ) : (
        <Link
          to="/page/$title"
          params={{ title: state.title }}
          className={clsx('mb-4 block font-semibold tracking-tight text-ink hover:text-accent', variant === 'stream' ? 'text-[1.7rem]' : 'text-lg')}
        >
          {state.title}
        </Link>
      )}
      <OutlineView
        pageTitle={state.title}
        outline={state.outline}
        rootIds={zoomed ? [zoomed] : state.outline.rootIds}
        zoomed={Boolean(zoomed)}
        focus={focus}
        actions={actions}
        selectedIds={selectedIds}
      />
      {zoomed ? (
        <BlockReferencesPanel blockId={zoomed} compact={variant !== 'main'} />
      ) : (
        <ReferencesPanel title={state.title} compact={variant !== 'main'} />
      )}
    </article>
  );
}
