import { useState, useEffect, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import type { DataRecord, PriceRecord, Snapshot, SnapshotAccount } from '../types';

function isDigital(unit: string): boolean {
  return unit.startsWith('$');
}

function buildSnapshots(data: DataRecord[], prices: PriceRecord[]): Snapshot[] {
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
    let debtUsd = 0;

    const accounts: SnapshotAccount[] = records.map((r) => {
      const price = priceMap.get(r.unit) ?? 0;
      const valueUsd = r.balance * price;
      totalUsd += valueUsd;
      if (valueUsd < 0) debtUsd += valueUsd;
      if (isDigital(r.unit)) digitalUsd += valueUsd;
      else fiatUsd += valueUsd;
      return { account: r.account, balance: r.balance, unit: r.unit, valueUsd };
    });

    snapshots.push({ date, accounts, totalUsd, fiatUsd, digitalUsd, debtUsd });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get tables by name
      const dataTable = await bitable.base.getTable('data');
      const priceTable = await bitable.base.getTable('prices');

      // Get field meta to map field ids to names
      const dataFields = await dataTable.getFieldMetaList();
      const priceFields = await priceTable.getFieldMetaList();

      const dataFieldMap = new Map(dataFields.map((f) => [f.name, f.id]));
      const priceFieldMap = new Map(priceFields.map((f) => [f.name, f.id]));

      const dateFieldId = dataFieldMap.get('Date') ?? dataFieldMap.get('date') ?? '';
      const accountFieldId = dataFieldMap.get('Account') ?? dataFieldMap.get('account') ?? '';
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

      // Fetch all data records
      const dataRecords = await fetchAllRecords(dataTable);
      const data: DataRecord[] = [];
      for (const rec of dataRecords) {
        const dateVal = rec.fields[dateFieldId];
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

        // Account: text field can be string or [{text:string}]
        let account = '';
        if (typeof accountVal === 'string') {
          account = accountVal;
        } else if (Array.isArray(accountVal) && accountVal.length > 0) {
          account = accountVal.map((seg: { text?: string }) => seg.text ?? '').join('');
        }

        // Balance: number
        const balance = typeof balanceVal === 'number' ? balanceVal : 0;

        // Unit: single select returns { id, text } or string
        let unit = '';
        if (typeof unitVal === 'string') {
          unit = unitVal;
        } else if (unitVal && typeof unitVal === 'object') {
          const uObj = unitVal as Record<string, unknown>;
          unit = (uObj.text ?? uObj.name ?? '') as string;
        }

        if (date && account && unit) {
          data.push({ date, account, balance, unit });
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

      setSnapshots(buildSnapshots(data, prices));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { snapshots, loading, error, reload: load };
}
