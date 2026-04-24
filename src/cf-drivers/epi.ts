import type { CashFlowItem } from '../types';
import type { ICashFlowDriver } from './driver';
import {
  monthsBetween,
  tsYM,
  isCashflowActiveMonth,
  startOfDay,
} from './scheduleUtils';

/**
 * EPI driver — Equal Principal & Interest (等额本息).
 *
 * `amount` = total principal (negative in table, we use absolute value).
 * `rate`   = annual interest rate in percent (e.g. 2.87 → 2.87%).
 * `start` / `end` = first / exclusive-end calendar month (timestamps); `term` must equal
 *   months between those months (computed at parse time, not from Base).
 *
 * Cashflow is active only in `[start, end)` months; payment index 0..term-1 from `start`.
 *
 * Monthly payment PMT = P × r × (1+r)^n / ((1+r)^n − 1), r = annual_rate / 100 / 12, n = term.
 */

function emptyEpiDriver(item: CashFlowItem): ICashFlowDriver {
  return {
    item,
    getMonthBreakdown(): Record<string, number> {
      return {};
    },
    getSpentMonths(): number {
      return 0;
    },
    getYearValue(): number {
      return 0;
    },
  };
}

export function createEpiDriver(item: CashFlowItem): ICashFlowDriver {
  const P = Math.abs(item.amount);
  const annualRate = item.rate; // percent
  const r = annualRate / 12; // monthly rate
  const totalMonths = item.term;

  if (!item.start || !item.end || totalMonths <= 0) {
    return emptyEpiDriver(item);
  }

  const [startY, startM] = tsYM(item.start);

  let pmt = 0;
  if (totalMonths > 0 && r > 0) {
    const rn = Math.pow(1 + r, totalMonths);
    pmt = P * r * rn / (rn - 1);
  } else if (totalMonths > 0) {
    pmt = P / totalMonths; // 0% interest
  }

  const emitKey = item.item.trim();

  return {
    item,
    getMonthBreakdown(year: number, month: number): Record<string, number> {
      if (!isCashflowActiveMonth(item, year, month)) return {};
      const mIdx = monthsBetween(startY, startM, year, month);
      if (mIdx < 0 || mIdx >= totalMonths) return {};
      const v = -pmt; // outflow
      return v === 0 ? {} : { [emitKey]: v };
    },
    getSpentMonths(): number {
      return totalMonths;
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
 * Remaining principal of an EPI loan as of `asOf` (ms timestamp).
 * Returns a positive number; the caller decides on sign (debt → negate).
 *
 * Before `start` (local start-of-day): 0. Uses same `start` + `term` schedule as the driver.
 */
export function epiRemainingPrincipal(item: CashFlowItem, asOf: number): number {
  const n = item.term;
  if (!item.start || !item.end || n <= 0) return 0;
  if (startOfDay(asOf) < startOfDay(item.start)) return 0;

  const P = Math.abs(item.amount);
  const r = item.rate / 12;

  const [startY, startM] = tsYM(item.start);

  const a = new Date(asOf);
  const aY = a.getFullYear();
  const aM = a.getMonth() + 1;
  const elapsed = Math.max(0, monthsBetween(startY, startM, aY, aM));
  const remaining = Math.max(0, n - elapsed);
  if (remaining <= 0) return 0;
  if (remaining >= n) return P;

  if (r > 0) {
    const rn = Math.pow(1 + r, n);
    const pmt = P * r * rn / (rn - 1);
    return pmt * (1 - Math.pow(1 + r, -remaining)) / r;
  }
  return P * remaining / n;
}
