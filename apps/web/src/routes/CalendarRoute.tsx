import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarController } from '../controllers/use-calendar-controller';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function CalendarRoute() {
  const calendar = useCalendarController();
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="page-title flex-1">
          {calendar.year} 年 {calendar.month + 1} 月
        </h1>
        <button type="button" className="icon-button" onClick={calendar.previous} title="上个月">
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="chip" onClick={calendar.goToday}>
          今天
        </button>
        <button type="button" className="icon-button" onClick={calendar.next} title="下个月">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1.5 text-center text-xs text-muted">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            周{day}
          </div>
        ))}
        {calendar.weeks.flat().map((title, index) => {
          if (!title) return <div key={`empty-${index}`} />;
          const count = calendar.notes.get(title);
          const isToday = title === calendar.today;
          return (
            <Link
              key={title}
              to="/page/$title"
              params={{ title }}
              className={clsx(
                'flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition md:aspect-[4/3]',
                count ? 'border-accent/30 bg-accent-soft/60 text-ink hover:bg-accent-soft' : 'border-line bg-panel text-muted hover:border-accent/40',
                isToday && 'ring-2 ring-accent',
              )}
            >
              <span className={clsx('font-medium', isToday && 'text-accent')}>{Number(title.slice(8))}</span>
              {count ? <span className="mt-0.5 text-[10px] text-accent">{count} 块</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
