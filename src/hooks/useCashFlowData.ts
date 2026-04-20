import { useState, useEffect, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import type { CashFlowItem, CashFlowDriverType } from '../types';

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

function parseDate(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    const v = (val as Record<string, unknown>).value;
    return typeof v === 'number' ? v : null;
  }
  return null;
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

const VALID_DRIVERS = new Set<string>(['EPI', 'Salary', 'Monthly', 'Yearly']);

export function useCashFlowData() {
  const [items, setItems] = useState<CashFlowItem[]>([]);
  const [cnyRate, setCnyRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cfiTable = await bitable.base.getTable('cfi');
      const priceTable = await bitable.base.getTable('prices');

      const cfiFields = await cfiTable.getFieldMetaList();
      const priceFields = await priceTable.getFieldMetaList();

      const fieldMap = new Map(cfiFields.map((f) => [f.name, f.id]));
      const priceFieldMap = new Map(priceFields.map((f) => [f.name, f.id]));

      const itemFieldId = fieldMap.get('item') ?? '';
      const driverFieldId = fieldMap.get('driver') ?? '';
      const amountFieldId = fieldMap.get('amount') ?? '';
      const unitFieldId = fieldMap.get('unit') ?? '';
      const rateFieldId = fieldMap.get('rate') ?? '';
      const endFieldId = fieldMap.get('end') ?? '';
      const termFieldId = fieldMap.get('term') ?? '';
      const accountsFieldId = fieldMap.get('accounts') ?? '';

      const symbolFieldId = priceFieldMap.get('symbol') ?? priceFieldMap.get('Symbol') ?? '';
      const priceFieldId = (() => {
        for (const [name, id] of priceFieldMap) {
          if (name.toLowerCase().startsWith('price')) return id;
        }
        return '';
      })();

      // Fetch cfi records
      const cfiRecords = await fetchAllRecords(cfiTable);
      const parsed: CashFlowItem[] = [];
      for (const rec of cfiRecords) {
        const driverRaw = parseSelect(rec.fields[driverFieldId]);
        if (!VALID_DRIVERS.has(driverRaw)) continue;

        parsed.push({
          item: parseText(rec.fields[itemFieldId]),
          driver: driverRaw as CashFlowDriverType,
          amount: typeof rec.fields[amountFieldId] === 'number' ? rec.fields[amountFieldId] : 0,
          unit: parseSelect(rec.fields[unitFieldId]),
          rate: typeof rec.fields[rateFieldId] === 'number' ? rec.fields[rateFieldId] : 0,
          end: parseDate(rec.fields[endFieldId]),
          term: typeof rec.fields[termFieldId] === 'number' ? rec.fields[termFieldId] : 0,
          accounts: parseSelect(rec.fields[accountsFieldId]),
        });
      }
      setItems(parsed);

      // Fetch CNY rate from prices table
      const priceRecords = await fetchAllRecords(priceTable);
      for (const rec of priceRecords) {
        const sym = parseSelect(rec.fields[symbolFieldId]);
        if (sym === 'CNY') {
          const p = rec.fields[priceFieldId];
          if (typeof p === 'number') setCnyRate(p);
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, cnyRate, loading, error, reload: load };
}
