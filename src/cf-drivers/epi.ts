import type { CashFlowItem } from '../types';
import type { ICashFlowDriver } from './driver';

/**
 * EPI driver — Equal Principal & Interest (等额本息).
 *
 * `amount` = total principal (negative in table, we use absolute value).
 * `rate`   = annual interest rate in percent (e.g. 2.87 → 2.87%).
 * `term`   = total loan term in months (e.g. 360).
 * `end`    = loan end date (timestamp ms).
 *
 * Monthly payment PMT = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = annual_rate / 100 / 12, n = term.
 */

function monthsBetween(y1: number, m1: number, y2: number, m2: number): number {
  return (y2 - y1) * 12 + (m2 - m1);
}

function endYM(endTs: number): [number, number] {
  const d = new Date(endTs);
  return [d.getFullYear(), d.getMonth() + 1];
}

/**
 * Convert a (year, month=1..12, totalMonths) tuple where (year, month) is the
 * **last** payment month into the (year, month=1..12) of the **first** payment.
 *
 *   If end = 2043/12 and term = 360, the 360 monthly payments span
 *   2014/01 → 2043/12, so this returns [2014, 1].
 *
 * Encoding note: months are addressed via Y*12 + M where M ∈ [1..12]; that
 * makes (Y=2024, M=12) == 24300 and (Y=2025, M=1) == 24301, so converting
 * back uses (m-1) to keep December at the right year boundary.
 */
function firstPaymentYM(endY: number, endM: number, totalMonths: number): [number, number] {
  const startTotal = endY * 12 + endM - totalMonths + 1;
  const startY = Math.floor((startTotal - 1) / 12);
  const startM = ((startTotal - 1) % 12 + 12) % 12 + 1;
  return [startY, startM];
}

export function createEpiDriver(item: CashFlowItem): ICashFlowDriver {
  const P = Math.abs(item.amount);
  const annualRate = item.rate; // percent
  const r = annualRate / 12; // monthly rate
  const totalMonths = item.term || 240; // fallback 20yr

  const [endY, endM] = item.end ? endYM(item.end) : [2099, 1];

  // `end` is the last payment month, so the first payment is `end - (term-1)`.
  const [startY, startM] = firstPaymentYM(endY, endM, totalMonths);

  // Compute PMT
  let pmt = 0;
  if (totalMonths > 0 && r > 0) {
    const rn = Math.pow(1 + r, totalMonths);
    pmt = P * r * rn / (rn - 1);
  } else if (totalMonths > 0) {
    pmt = P / totalMonths; // 0% interest
  }

  return {
    item,
    getMonthValue(year: number, month: number): number {
      // Before start or after end → 0
      const mIdx = monthsBetween(startY, startM, year, month);
      if (mIdx < 0 || mIdx >= totalMonths) return 0;
      return -pmt; // outflow
    },
    getSpentMonths(): number {
      return totalMonths;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) sum += this.getMonthValue(year, m);
      return sum;
    },
  };
}

/**
 * Remaining principal of an EPI loan as of `asOf` (ms timestamp).
 * Returns a positive number; the caller decides on sign (debt → negate).
 *
 * Mirrors the conventions used by `createEpiDriver` so the math stays
 * consistent across the app (notably `r = item.rate / 12`).
 */
export function epiRemainingPrincipal(item: CashFlowItem, asOf: number): number {
  const n = item.term;
  if (!item.end || !n || n <= 0) return 0;
  const P = Math.abs(item.amount);
  const r = item.rate / 12;

  const [endY, endM] = endYM(item.end);
  const [startY, startM] = firstPaymentYM(endY, endM, n);

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
