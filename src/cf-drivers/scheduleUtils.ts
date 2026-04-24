import type { CashFlowItem } from '../types';

/** Calendar (year, month 1–12) for a timestamp in local time. */
export function tsYM(ts: number): [number, number] {
  const d = new Date(ts);
  return [d.getFullYear(), d.getMonth() + 1];
}

export function monthsBetween(y1: number, m1: number, y2: number, m2: number): number {
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Local start-of-day ms for comparison. */
export function startOfDay(ts: number): number {
  return new Date(ts).setHours(0, 0, 0, 0);
}

/**
 * EPI term: whole months from start month to end month (same formula as legacy span).
 * Example: 2013/12 → 2043/12 gives 360; payments occupy months 0..359 from start.
 */
export function epiTermMonthsFromStartEnd(startTs: number, endTs: number): number {
  const [sy, sm] = tsYM(startTs);
  const [ey, em] = tsYM(endTs);
  return monthsBetween(sy, sm, ey, em);
}

/**
 * Whether `(year, month)` lies in [start, end) on the calendar-month axis.
 * - `start` null: no lower bound.
 * - `end` null: no upper bound.
 * - `end` set: month of `end` is the first non-emitting month (exclusive).
 */
export function isCashflowActiveMonth(
  item: CashFlowItem,
  year: number,
  month: number,
): boolean {
  if (item.start != null) {
    const [sy, sm] = tsYM(item.start);
    if (year < sy || (year === sy && month < sm)) return false;
  }
  if (item.end != null) {
    const [ey, em] = tsYM(item.end);
    if (year > ey || (year === ey && month >= em)) return false;
  }
  return true;
}
