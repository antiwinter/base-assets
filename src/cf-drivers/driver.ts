import type { CashFlowItem } from '../types';
import { createEpiDriver } from './epi';
import { createSalaryDriver } from './salary';
import { createMonthlyDriver, createYearlyDriver } from './periodic';

export interface ICashFlowDriver {
  /** The originating item */
  item: CashFlowItem;
  /** Named lines for one month (positive = in, negative = out). month is 1-based. Omit zero lines. */
  getMonthBreakdown(year: number, month: number): Record<string, number>;
  /** Total months this item has been / will be active (Infinity if no end) */
  getSpentMonths(): number;
  /** Sum of all breakdown values across months 1–12 for the year */
  getYearValue(year: number): number;
}

export function createDriver(item: CashFlowItem): ICashFlowDriver {
  switch (item.driver) {
    case 'EPI':
      return createEpiDriver(item);
    case 'Salary':
      return createSalaryDriver(item);
    case 'Monthly':
      return createMonthlyDriver(item);
    case 'Yearly':
      return createYearlyDriver(item);
    default:
      return createMonthlyDriver(item);
  }
}

export function findDrivers(items: CashFlowItem[], driverType?: string): ICashFlowDriver[] {
  const filtered = driverType
    ? items.filter((i) => i.driver === driverType)
    : items;
  return filtered.map(createDriver);
}
