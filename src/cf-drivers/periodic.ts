import type { CashFlowItem } from '../types';
import type { ICashFlowDriver } from './driver';
import { isCashflowActiveMonth } from './scheduleUtils';

/**
 * Monthly driver — returns `amount` every active month in `[start, end)` (see scheduleUtils).
 */
export function createMonthlyDriver(item: CashFlowItem): ICashFlowDriver {
  const endDate = item.end ? new Date(item.end) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;

  const emitKey = item.item.trim();

  return {
    item,
    getMonthBreakdown(year: number, month: number): Record<string, number> {
      if (!isCashflowActiveMonth(item, year, month)) return {};
      const v = item.amount;
      return v === 0 ? {} : { [emitKey]: v };
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      return (endY - 2020) * 12 + endM;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) {
        for (const v of Object.values(this.getMonthBreakdown(year, m))) sum += v;
      }
      return sum;
    },
  };
}

/**
 * Yearly driver — returns `amount` once per year in the renewal month (from `end`'s month),
 * only when that month lies in `[start, end)`.
 */
export function createYearlyDriver(item: CashFlowItem): ICashFlowDriver {
  const endDate = item.end ? new Date(item.end) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;
  const renewalMonth = endDate ? endDate.getMonth() + 1 : 1;

  const emitKey = item.item.trim();

  return {
    item,
    getMonthBreakdown(year: number, month: number): Record<string, number> {
      if (!isCashflowActiveMonth(item, year, month)) return {};
      if (month !== renewalMonth) return {};
      const v = item.amount;
      return v === 0 ? {} : { [emitKey]: v };
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      return (endY - 2020) * 12 + endM;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) {
        for (const v of Object.values(this.getMonthBreakdown(year, m))) sum += v;
      }
      return sum;
    },
  };
}
