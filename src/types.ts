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

export interface SnapshotAccount {
  platform: string;
  account: string;
  balance: number;
  unit: string;
  valueUsd: number;
}

export interface Snapshot {
  date: number;
  accounts: SnapshotAccount[];
  totalUsd: number;
  fiatUsd: number;
  digitalUsd: number;
  stockUsd: number;
  debtUsd: number;
}
