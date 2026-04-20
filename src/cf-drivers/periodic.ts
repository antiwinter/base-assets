import type { CashFlowItem } from '../types';
import type { ICashFlowDriver } from './driver';

/**
 * Monthly driver — returns `amount` every month until end (or forever).
 */
export function createMonthlyDriver(item: CashFlowItem): ICashFlowDriver {
  const endDate = item.end ? new Date(item.end) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;

  return {
    item,
    getMonthValue(year: number, month: number): number {
      if (year > endY || (year === endY && month > endM)) return 0;
      return item.amount;
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      return (endY - 2020) * 12 + endM;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) sum += this.getMonthValue(year, m);
      return sum;
    },
  };
}

/**
 * Yearly driver — returns `amount` once per year in the renewal month.
 *
 * Renewal month is derived from the `end` field's month component.
 * If no end date, defaults to January.
 */
export function createYearlyDriver(item: CashFlowItem): ICashFlowDriver {
  const endDate = item.end ? new Date(item.end) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;
  const renewalMonth = endDate ? endDate.getMonth() + 1 : 1;

  return {
    item,
    getMonthValue(year: number, month: number): number {
      if (year > endY || (year === endY && month > endM)) return 0;
      if (month !== renewalMonth) return 0;
      return item.amount;
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      return (endY - 2020) * 12 + endM;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) sum += this.getMonthValue(year, m);
      return sum;
    },
  };
}
