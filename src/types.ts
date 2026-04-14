export interface DataRecord {
  date: number; // timestamp ms
  account: string;
  balance: number;
  unit: string; // e.g. "CNY", "$BTC"
}

export interface PriceRecord {
  symbol: string; // e.g. "CNY", "$BTC"
  price: number;  // USD price
}

export interface SnapshotAccount {
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
  debtUsd: number;
}
