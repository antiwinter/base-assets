import { useState, useEffect, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import type { CashFlowItem, DataRecord, PriceRecord, Snapshot, SnapshotAccount } from '../types';
import { fetchAllRecords, parseSelect } from './larkUtils';
import { categorizeAccount } from './portfolioUtils';
import { epiLoanSnapshotAccountsForDate, parseEpiCashFlowItems } from './snapshotEntries';

function snapshotAccountFromDataRecord(
  r: DataRecord,
  priceMap: Map<string, number>,
  platformTypeMap: Map<string, string>,
): SnapshotAccount {
  const price = priceMap.get(r.unit) ?? 0;
  const valueUsd = r.balance * price;
  const platformType = platformTypeMap.get(r.platform) ?? '';
  const category = categorizeAccount(r.account, r.unit, platformType);
  return { platform: r.platform, account: r.account, balance: r.balance, unit: r.unit, valueUsd, category };
}

function sumSnapshotTotals(accounts: SnapshotAccount[]): Pick<
  Snapshot,
  'totalUsd' | 'fiatUsd' | 'digitalUsd' | 'stockUsd' | 'fixedUsd' | 'debtUsd'
> {
  let totalUsd = 0;
  let fiatUsd = 0;
  let digitalUsd = 0;
  let stockUsd = 0;
  let fixedUsd = 0;
  let debtUsd = 0;
  for (const a of accounts) {
    totalUsd += a.valueUsd;
    switch (a.category) {
      case 'debt':    debtUsd    += a.valueUsd; break;
      case 'stock':   stockUsd   += a.valueUsd; break;
      case 'digital': digitalUsd += a.valueUsd; break;
      case 'fixed':   fixedUsd   += a.valueUsd; break;
      case 'fiat':    fiatUsd    += a.valueUsd; break;
    }
  }
  return { totalUsd, fiatUsd, digitalUsd, stockUsd, fixedUsd, debtUsd };
}

function buildSnapshots(
  data: DataRecord[],
  prices: PriceRecord[],
  platformTypeMap: Map<string, string>,
  epiItems: CashFlowItem[],
): Snapshot[] {
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    priceMap.set(p.symbol, p.price);
  }

  const grouped = new Map<number, DataRecord[]>();
  for (const r of data) {
    const existing = grouped.get(r.date);
    if (existing) existing.push(r);
    else grouped.set(r.date, [r]);
  }

  const snapshots: Snapshot[] = [];
  for (const [date, records] of grouped) {
    const fromData = records.map((r) => snapshotAccountFromDataRecord(r, priceMap, platformTypeMap));
    const fromEpi = epiLoanSnapshotAccountsForDate(epiItems, date, priceMap);
    const accounts = [...fromData, ...fromEpi];
    const totals = sumSnapshotTotals(accounts);
    snapshots.push({ date, accounts, ...totals });
  }

  snapshots.sort((a, b) => a.date - b.date);
  return snapshots;
}

export function usePortfolioData() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [cnyRate, setCnyRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    try {
      if (!silent) setLoading(true);
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

      const cfiTable = await bitable.base.getTable('cfi');
      const cfiFields = await cfiTable.getFieldMetaList();
      const cfiFieldMap = new Map(cfiFields.map((f) => [f.name, f.id]));
      const cfiRecords = await fetchAllRecords(cfiTable);
      const epiItems = parseEpiCashFlowItems(cfiRecords, cfiFieldMap);

      setSnapshots(buildSnapshots(data, prices, platformTypeMap, epiItems));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const reloadSilent = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { snapshots, cnyRate, loading, error, reload: load, reloadSilent };
}
