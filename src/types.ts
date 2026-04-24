export const CAT_COLORS: Record<string, string> = {
  Fiat: '#8dc77b',
  Stock: '#9698e5',
  Digital: '#f8c12d',
  Fixed: '#000000',
  Debt: '#ff6262',
};

export interface DataRecord {
  date: number; // timestamp ms
  platform: string;
  account: string; // "debt", "stock", or "" (fiat balance)
  balance: number;
  unit: string; // e.g. "CNY", "$BTC"
}

export interface PriceRecord {
  symbol: string; // e.g. "CNY", "$BTC"
  price: number;  // USD price
}

export type AssetCategory = 'fiat' | 'digital' | 'stock' | 'fixed' | 'debt';

export interface SnapshotAccount {
  platform: string;
  account: string;
  balance: number;
  unit: string;
  valueUsd: number;
  category: AssetCategory;
}

export interface Snapshot {
  date: number;
  accounts: SnapshotAccount[];
  totalUsd: number;
  fiatUsd: number;
  digitalUsd: number;
  stockUsd: number;
  fixedUsd: number;
  debtUsd: number;
}

export type CashFlowDriverType = 'EPI' | 'Salary' | 'Monthly' | 'Yearly';

export interface CashFlowItem {
  item: string;
  driver: CashFlowDriverType;
  amount: number;
  unit: string;        // e.g. "USD", "CNY" (empty → CNY)
  rate: number;        // annual interest rate in percent (e.g. 2.87)
  /** First calendar month that may emit; null = no lower bound (legacy). */
  start: number | null;
  /**
   * Exclusive upper bound on the calendar-month axis: first month that does not emit.
   * Timestamp ms; null = no upper bound.
   */
  end: number | null;
  /** EPI: computed months between start and end; others: optional from sheet, else 0. */
  term: number;
  accounts: string;
}

/** Format a number with 3 significant digits + k/m suffix */
export function fmtHuman(v: number, fmt?: 'east'): string {
  const abs = Math.abs(v);
  const eastFmt = (n: number, unit: string) => {
    const absN = Math.abs(n);
    const s = absN >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');
    return `${s}${unit}`;
  };
  if (fmt === 'east') {
    if (abs >= 100_000_000) return eastFmt(v / 100_000_000, 'y');
    if (abs >= 10_000)      return eastFmt(v / 10_000, 'w');
    return v.toFixed(0);
  }
  if (abs >= 1_000_000) {
    const n = v / 1_000_000;
    return `${abs >= 100_000_000 ? n.toFixed(0) : abs >= 10_000_000 ? n.toFixed(1) : n.toFixed(2)}m`;
  }
  if (abs >= 1_000) {
    const n = v / 1_000;
    return `${abs >= 100_000 ? n.toFixed(0) : abs >= 10_000 ? n.toFixed(1) : n.toFixed(2)}k`;
  }
  return v.toFixed(0);
}
