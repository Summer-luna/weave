import { useEffect, useRef } from 'react';
import { PageView } from '../components/page/PageView';
import { useDailyNotesController } from '../controllers/use-daily-notes-controller';

export function DailyNotesRoute() {
  const { titles, hasMore, loadMore } = useDailyNotesController();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-4">
      {titles.map((title) => (
        <PageView key={title} title={title} variant="stream" />
      ))}
      <div ref={sentinel} className="py-8 text-center text-sm text-muted">
        {hasMore ? '加载更早的日记…' : titles.length > 1 ? '没有更早的日记了' : ''}
      </div>
    </div>
  );
}
