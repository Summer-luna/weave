const DAILY_TITLE = /^\d{4}-\d{2}-\d{2}$/;

export class DailyNoteService {
  titleFor(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  today(): string {
    return this.titleFor(new Date());
  }

  monthGrid(year: number, month: number): (string | null)[][] {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: days }, (_, i) => this.titleFor(new Date(year, month, i + 1))),
    ];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }

  isDailyTitle(title: string): boolean {
    return DAILY_TITLE.test(title);
  }

  describe(title: string): string | null {
    if (!this.isDailyTitle(title)) return null;
    const [y, m, d] = title.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }
}

export const dailyNoteService = new DailyNoteService();
