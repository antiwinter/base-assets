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
 * Returns net take-home (positive) each month. Amount varies as brackets escalate.
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

export function createSalaryDriver(item: CashFlowItem): ICashFlowDriver {
  const gross = item.amount; // positive
  const endTs = item.end;
  const endDate = endTs ? new Date(endTs) : null;
  const endY = endDate ? endDate.getFullYear() : Infinity;
  const endM = endDate ? endDate.getMonth() + 1 : Infinity;

  const socialInsurance = calcSocialInsurance(Math.abs(gross));
  const monthlyTaxable = Math.abs(gross) - socialInsurance - 5000;

  return {
    item,
    getMonthValue(year: number, month: number): number {
      // Past end date → 0
      if (year > endY || (year === endY && month > endM)) return 0;

      // month is 1-based within the calendar year
      // Cumulative withholding resets every January
      const cumulativeTaxable = month * monthlyTaxable;
      const cumulativeTax = calcCumulativeTax(cumulativeTaxable);
      const prevCumulativeTax = month > 1
        ? calcCumulativeTax((month - 1) * monthlyTaxable)
        : 0;
      const thisMonthTax = Math.max(0, cumulativeTax - prevCumulativeTax);

      return Math.abs(gross) - socialInsurance - thisMonthTax;
    },
    getSpentMonths(): number {
      if (!endDate) return Infinity;
      // Approximate from a fixed reference (Jan 2020)
      return (endY - 2020) * 12 + endM;
    },
    getYearValue(year: number): number {
      let sum = 0;
      for (let m = 1; m <= 12; m++) sum += this.getMonthValue(year, m);
      return sum;
    },
  };
}
