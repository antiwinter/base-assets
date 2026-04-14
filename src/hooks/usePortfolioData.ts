import { useState, useEffect, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import type { DataRecord, PriceRecord, Snapshot, SnapshotAccount } from '../types';

function parseSelect(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    return (o.text ?? o.name ?? '') as string;
  }
  if (Array.isArray(val) && val.length > 0) {
    return val.map((seg: { text?: string }) => seg.text ?? '').join('');
  }
  return '';
}

function parseText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) {
    return val.map((seg: { text?: string }) => seg.text ?? '').join('');
  }
  return '';
}

function buildSnapshots(
  data: DataRecord[],
  prices: PriceRecord[],
  platformTypeMap: Map<string, string>,
): Snapshot[] {
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    priceMap.set(p.symbol, p.price);
  }

  // Group by date
  const grouped = new Map<number, DataRecord[]>();
  for (const r of data) {
    const existing = grouped.get(r.date);
    if (existing) existing.push(r);
    else grouped.set(r.date, [r]);
  }

  const snapshots: Snapshot[] = [];
  for (const [date, records] of grouped) {
    let totalUsd = 0;
    let fiatUsd = 0;
    let digitalUsd = 0;
    let stockUsd = 0;
    let debtUsd = 0;

    const accounts: SnapshotAccount[] = records.map((r) => {
      const price = priceMap.get(r.unit) ?? 0;
      const valueUsd = r.balance * price;
      totalUsd += valueUsd;

      const acct = r.account.toLowerCase();
      const platformType = platformTypeMap.get(r.platform)?.toLowerCase() ?? '';

      if (acct === 'debt') {
        debtUsd += valueUsd;
      } else if (acct === 'stock') {
        stockUsd += valueUsd;
      } else if (platformType === 'ex') {
        digitalUsd += valueUsd;
      } else {
        // no account set → fiat balance
        fiatUsd += valueUsd;
      }

      return { platform: r.platform, account: r.account, balance: r.balance, unit: r.unit, valueUsd };
    });

    snapshots.push({ date, accounts, totalUsd, fiatUsd, digitalUsd, stockUsd, debtUsd });
  }

  snapshots.sort((a, b) => a.date - b.date);
  return snapshots;
}

async function fetchAllRecords(table: Awaited<ReturnType<typeof bitable.base.getTable>>) {
  const all: Array<{ fields: Record<string, unknown> }> = [];
  let pageToken: string | undefined;
  while (true) {
    const resp = await table.getRecords({ pageSize: 5000, pageToken });
    all.push(...resp.records);
    if (!resp.hasMore) break;
    pageToken = resp.pageToken;
  }
  return all;
}

export function usePortfolioData() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [cnyRate, setCnyRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get tables by name
      const dataTable = await bitable.base.getTable('data');
      const priceTable = await bitable.base.getTable('prices');
      const accountsTable = await bitable.base.getTable('accounts');

      // Get field meta to map field ids to names
      const dataFields = await dataTable.getFieldMetaList();
      const priceFields = await priceTable.getFieldMetaList();
      const acctFields = await accountsTable.getFieldMetaList();

      const dataFieldMap = new Map(dataFields.map((f) => [f.name, f.id]));
      const priceFieldMap = new Map(priceFields.map((f) => [f.name, f.id]));
      const acctFieldMap = new Map(acctFields.map((f) => [f.name, f.id]));

      const dateFieldId = dataFieldMap.get('Date') ?? dataFieldMap.get('date') ?? '';
      const platformFieldId = dataFieldMap.get('platform') ?? dataFieldMap.get('Platform') ?? '';
      const accountFieldId = dataFieldMap.get('account') ?? dataFieldMap.get('Account') ?? '';
      const balanceFieldId = dataFieldMap.get('Balance') ?? dataFieldMap.get('balance') ?? '';
      const unitFieldId = dataFieldMap.get('Unit') ?? dataFieldMap.get('unit') ?? '';

      const symbolFieldId = priceFieldMap.get('symbol') ?? priceFieldMap.get('Symbol') ?? '';
      // Match field name flexibly: "price (USD)", "price", "Price", etc.
      const priceFieldId = (() => {
        for (const [name, id] of priceFieldMap) {
          if (name.toLowerCase().startsWith('price')) return id;
        }
        return '';
      })();

      const acctPlatformFieldId = acctFieldMap.get('platform') ?? acctFieldMap.get('Platform') ?? '';
      const acctTypeFieldId = acctFieldMap.get('type') ?? acctFieldMap.get('Type') ?? '';

      // Fetch accounts table → platform→type map
      const acctRecords = await fetchAllRecords(accountsTable);
      const platformTypeMap = new Map<string, string>();
      for (const rec of acctRecords) {
        const platform = parseSelect(rec.fields[acctPlatformFieldId]);
        const type = parseSelect(rec.fields[acctTypeFieldId]);
        if (platform) platformTypeMap.set(platform, type);
      }

      // Fetch all data records
      const dataRecords = await fetchAllRecords(dataTable);
      const data: DataRecord[] = [];
      for (const rec of dataRecords) {
        const dateVal = rec.fields[dateFieldId];
        const platformVal = rec.fields[platformFieldId];
        const accountVal = rec.fields[accountFieldId];
        const balanceVal = rec.fields[balanceFieldId];
        const unitVal = rec.fields[unitFieldId];

        // Date can be a timestamp number
        let date = 0;
        if (typeof dateVal === 'number') {
          date = dateVal;
        } else if (dateVal && typeof dateVal === 'object' && 'value' in (dateVal as Record<string, unknown>)) {
          date = (dateVal as Record<string, unknown>).value as number;
        }

        // Normalize to day boundary (strip time)
        date = new Date(date).setHours(0, 0, 0, 0);

        const platform = parseSelect(platformVal);
        const account = parseSelect(accountVal);
        const balance = typeof balanceVal === 'number' ? balanceVal : 0;
        const unit = parseSelect(unitVal);

        if (date && platform && unit) {
          data.push({ date, platform, account, balance, unit });
        }
      }

      // Fetch price records
      const priceRecords = await fetchAllRecords(priceTable);
      const prices: PriceRecord[] = [];
      for (const rec of priceRecords) {
        const symVal = rec.fields[symbolFieldId];
        const pVal = rec.fields[priceFieldId];

        // symbol is a single select field: returns { id, text } or string
        let symbol = '';
        if (typeof symVal === 'string') {
          symbol = symVal;
        } else if (symVal && typeof symVal === 'object' && !Array.isArray(symVal)) {
          const sObj = symVal as Record<string, unknown>;
          symbol = (sObj.text ?? sObj.name ?? '') as string;
        } else if (Array.isArray(symVal) && symVal.length > 0) {
          symbol = symVal.map((seg: { text?: string }) => seg.text ?? '').join('');
        }

        const price = typeof pVal === 'number' ? pVal : 0;
        if (symbol) {
          prices.push({ symbol, price });
        }
      }

      // Compute CNY/USD rate
      const cnyPrice = prices.find((p) => p.symbol === 'CNY');
      if (cnyPrice && cnyPrice.price > 0) {
        setCnyRate(1 / cnyPrice.price);
      }

      setSnapshots(buildSnapshots(data, prices, platformTypeMap));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { snapshots, cnyRate, loading, error, reload: load };
}
