import { describe, expect, it } from 'vitest';
import { DailyNoteService } from '../src/services/daily-note-service';

describe('DailyNoteService.monthGrid', () => {
  it('lays a month out in Monday-first weeks', () => {
    const weeks = new DailyNoteService().monthGrid(2026, 10);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.at(-1)!.filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
