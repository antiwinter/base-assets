import type { CashFlowItem } from '../types';
import { createDriver } from '../cf-drivers/driver';

export const INCOME_COLORS = ['#63c77d', '#4fbf96', '#3db4ad', '#2f9fc2'];
export const EXPENSE_COLORS = ['#7b4db8', '#9a5fb7', '#c98b74', '#f2c84b'];

interface ValueEntry {
  value: number;
}

export interface Top3Buckets {
  top1: number;
  top2: number;
  top3: number;
  others: number;
}

export interface DriverWithRate {
  itemName: string;
  getMonthValue: (year: number, month: number) => number;
  convRate: number;
}

export function buildDriversWithRates(
  items: CashFlowItem[],
  rate: number,
  prices: Map<string, number>,
): DriverWithRate[] {
  const cnyPriceUsd = prices.get('CNY') || 0.15;
  const displayingCny = rate !== 1;

  return items.map((item) => {
    const unitPriceUsd = item.unit ? (prices.get(item.unit) ?? 1) : cnyPriceUsd;
    const convRate = displayingCny ? unitPriceUsd / cnyPriceUsd : unitPriceUsd;
    const driver = createDriver(item);

    return {
      itemName: driver.item.item,
      getMonthValue: driver.getMonthValue.bind(driver),
      convRate,
    };
  });
}

export function splitTop3(entries: ValueEntry[], byAbs: boolean): Top3Buckets {
  const sorted = [...entries].sort((a, b) => {
    const av = byAbs ? Math.abs(a.value) : a.value;
    const bv = byAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  });

  return {
    top1: sorted[0]?.value ?? 0,
    top2: sorted[1]?.value ?? 0,
    top3: sorted[2]?.value ?? 0,
    others: sorted.slice(3).reduce((sum, e) => sum + e.value, 0),
  };
}

export function findTopmostPositiveKey<T extends string>(
  row: Record<string, number>,
  renderOrder: readonly T[],
): T | undefined {
  for (let i = renderOrder.length - 1; i >= 0; i -= 1) {
    const key = renderOrder[i];
    if ((row[key] ?? 0) > 0) return key;
  }
  return undefined;
}

export function findBottommostNegativeKey<T extends string>(
  row: Record<string, number>,
  renderOrder: readonly T[],
): T | undefined {
  for (let i = renderOrder.length - 1; i >= 0; i -= 1) {
    const key = renderOrder[i];
    if ((row[key] ?? 0) < 0) return key;
  }
  return undefined;
}
