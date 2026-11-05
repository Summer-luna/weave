import { Link } from '@tanstack/react-router';
import { MouseEvent, ReactNode } from 'react';
import { toPlainText } from '../../controllers/use-content-view';
import { useLayoutController } from '../../controllers/use-layout-controller';
import type { ReferenceGroup } from '../../types/models';
import { RichContent } from '../content/RichContent';

interface ReferenceGroupCardProps {
  group: ReferenceGroup;
  action?: (blockId: string) => ReactNode;
}

export function ReferenceGroupCard({ group, action }: ReferenceGroupCardProps) {
  const layout = useLayoutController();
  const sidebarClick = (id: string) => (event: MouseEvent) => {
    if (!event.shiftKey) return;
    event.preventDefault();
    layout.openInSidebar({ kind: 'block', id });
  };

  return (
    <div className="reference-card">
      <Link to="/page/$title" params={{ title: group.pageTitle }} className="reference-page">
        {group.pageTitle}
      </Link>
      <ul className="mt-2 space-y-2">
        {group.items.map((item) => (
          <li key={item.block.id} className="reference-item">
            {item.breadcrumbs.length > 0 && (
              <div className="breadcrumbs">
                {item.breadcrumbs.map((crumb, index) => (
                  <span key={crumb.id}>
                    {index > 0 && '  ›  '}
                    <Link
                      to="/page/$title"
                      params={{ title: group.pageTitle }}
                      search={{ zoom: crumb.id }}
                      className="hover:text-accent"
                      onClick={sidebarClick(crumb.id)}
                    >
                      {toPlainText(crumb.content) || '…'}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-start gap-2">
              <Link
                to="/page/$title"
                params={{ title: group.pageTitle }}
                search={{ zoom: item.block.id }}
                className="reference-bullet"
                title="点击聚焦到这个块，Shift+点击在右侧打开"
                onClick={sidebarClick(item.block.id)}
              >
                <span className="reference-dot" />
              </Link>
              <div className="min-w-0 flex-1 leading-relaxed">
                <RichContent content={item.block.content} />
              </div>
              {action?.(item.block.id)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
