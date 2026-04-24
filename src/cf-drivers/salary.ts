import type { CashFlowItem } from '../types';
import type { ICashFlowDriver } from './driver';

/**
 * Salary driver — Chinese payroll with 五险一金 + 累计预扣法 (cumulative withholding).
 *
 * `amount` = gross monthly salary (税前月薪, in CNY).
 * `end`    = employment end date (null = ongoing).
 *
 * Social insurance + housing fund (个人部分, Beijing standard):
 *   养老 8%, 医疗 2% + ¥3, 失业 0.5%, 公积金 12%
 *   Total ≈ 22.5% + ¥3
 *
 * Personal income tax uses cumulative withholding method (累计预扣法):
 *   Each month m (1-based within calendar year):
 *     cumulative_taxable = m × (gross − 五险一金 − 5000)
 *     cumulative_tax     = cumulative_taxable × bracket_rate − quick_deduction
 *     this_month_tax     = cumulative_tax − previous_cumulative_tax
 *
 * Emits three lines (keys from `item` name, lowercased): base net, `{base}-fund`
 * (monthly employer contribution line, ¥3730), `{base}-bonus` in February only
 * (bonus = gross × 0.7). Past `end` → no lines.
 */

// Progressive tax brackets (annual cumulative taxable income thresholds)
const TAX_BRACKETS: [number, number, number][] = [
  //  [upper_bound, rate, quick_deduction]
  [36_000,   0.03,      0],
  [144_000,  0.10,   2520],
  [300_000,  0.20,  16920],
  [420_000,  0.25,  31920],
  [660_000,  0.30,  52920],
  [960_000,  0.35,  85920],
  [Infinity, 0.45, 181920],
];

function calcCumulativeTax(cumulativeTaxable: number): number {
  if (cumulativeTaxable <= 0) return 0;
  for (const [upper, rate, deduction] of TAX_BRACKETS) {
    if (cumulativeTaxable <= upper) {
      return cumulativeTaxable * rate - deduction;
    }
  }
  // Should not reach here, last bracket is Infinity
  const last = TAX_BRACKETS[TAX_BRACKETS.length - 1];
  return cumulativeTaxable * last[1] - last[2];
}

function calcSocialInsurance(gross: number): number {
  // 养老 8% + 医疗 2% + ¥3 + 失业 0.5% + 公积金 12%
  return gross * 0.225 + 3;
}

/** Monthly fund line (was a separate cfi row). */
const FUND_MONTHLY = 3730;

export function createSalaryDriver(item: CashFlowItem): ICashFlowDriver {
  const gross = item.amount; // positive
  const grossAbs = Math.abs(gross);
  const endTs = item.end;
  const endDate = endTs ? new Date(endTs) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;

  const socialInsurance = calcSocialInsurance(grossAbs);
  const monthlyTaxable = grossAbs - socialInsurance - 5000;
  const emitBase = item.item.trim().toLowerCase();

  function netTakeHome(year: number, month: number): number {
    if (year > endY || (year === endY && month > endM)) return 0;
    const cumulativeTaxable = month * monthlyTaxable;
    const cumulativeTax = calcCumulativeTax(cumulativeTaxable);
    const prevCumulativeTax = month > 1
      ? calcCumulativeTax((month - 1) * monthlyTaxable)
      : 0;
    const thisMonthTax = Math.max(0, cumulativeTax - prevCumulativeTax);
    return grossAbs - socialInsurance - thisMonthTax;
  }

  return {
    item,
    getMonthBreakdown(year: number, month: number): Record<string, number> {
      if (year > endY || (year === endY && month > endM)) return {};

      const out: Record<string, number> = {};
      const net = netTakeHome(year, month);
      if (net !== 0) out[emitBase] = net;
      out[`${emitBase}-fund`] = FUND_MONTHLY;
      if (month === 2) {
        const bonus = grossAbs * 0.7;
        if (bonus !== 0) out[`${emitBase}-bonus`] = bonus;
      }
      return out;
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      // Approximate from a fixed reference (Jan 2020)
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
