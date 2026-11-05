import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { toPlainText } from '../../controllers/use-content-view';

interface ZoomBreadcrumbsProps {
  pageTitle: string;
  path: { id: string; content: string }[];
}

export function ZoomBreadcrumbs({ pageTitle, path }: ZoomBreadcrumbsProps) {
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link to="/page/$title" params={{ title: pageTitle }} className="font-medium text-ink/80 hover:text-accent">
        {pageTitle}
      </Link>
      {path.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <ChevronRight size={13} className="opacity-50" />
          <Link
            to="/page/$title"
            params={{ title: pageTitle }}
            search={{ zoom: crumb.id }}
            className="max-w-[16rem] truncate hover:text-accent"
          >
            {toPlainText(crumb.content) || '…'}
          </Link>
        </span>
      ))}
    </nav>
  );
}
