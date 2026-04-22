import { useState, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';

type AssetEntry = { recordId: string; symbol: string; assetId: string };

function parseTextField(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    return (o.text ?? o.name ?? '') as string;
  }
  if (Array.isArray(val) && val.length > 0) {
    return (val as Array<{ text?: string }>).map((s) => s.text ?? '').join('');
  }
  return '';
}

async function getSettingValue(candidates: string[]): Promise<string> {
  const settingsTable = await bitable.base.getTable('settings');
  const settingFields = await settingsTable.getFieldMetaList();
  const fieldMap = new Map(settingFields.map((f) => [f.name, f.id]));

  const keyFieldId = fieldMap.get('key') ?? fieldMap.get('Key') ?? '';
  const valueFieldId = fieldMap.get('value') ?? fieldMap.get('Value') ?? '';
  if (!keyFieldId || !valueFieldId) {
    throw new Error('Could not find key/value fields in settings table');
  }

  const resp = await settingsTable.getRecords({ pageSize: 5000 });
  const wanted = new Set(candidates.map((c) => c.trim().toLowerCase()));
  for (const rec of resp.records) {
    const key = parseTextField(rec.fields[keyFieldId]).trim().toLowerCase();
    if (!wanted.has(key)) continue;
    const value = parseTextField(rec.fields[valueFieldId]).trim();
    if (value) return value;
  }

  throw new Error(`Missing API key in settings table for: ${candidates.join(', ')}`);
}

// Crypto: symbol starts with '$', assetId is the CoinGecko coin id (e.g. "bitcoin")
async function fetchCryptoPrices(entries: AssetEntry[]): Promise<Record<string, number>> {
  if (entries.length === 0) return {};
  const ids = entries.map((e) => e.assetId).join(',');
  const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  if (!resp.ok) throw new Error(`CoinGecko API error: ${resp.status} ${resp.statusText}`);
  const data: Record<string, { usd: number }> = await resp.json();
  const result: Record<string, number> = {};
  for (const e of entries) {
    if (data[e.assetId]?.usd !== undefined) result[e.symbol] = data[e.assetId].usd;
  }
  return result;
}

// Fiat: symbol is the ISO currency code (e.g. "CNY"), assetId matches symbol
async function fetchFiatRates(entries: AssetEntry[]): Promise<Record<string, number>> {
  if (entries.length === 0) return {};
  const resp = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!resp.ok) throw new Error(`Exchange rate API error: ${resp.status} ${resp.statusText}`);
  const data: { result: string; rates: Record<string, number> } = await resp.json();
  if (data.result !== 'success') throw new Error('Exchange rate API returned non-success result');
  const result: Record<string, number> = {};
  for (const e of entries) {
    const rate = data.rates[e.symbol];
    if (rate && rate > 0) result[e.symbol] = 1 / rate;
  }
  return result;
}

// Stocks: assetId is "{exchange}/{ticker}" (e.g. "nasdaq/icg"), uses Twelve Data
async function fetchStockPrices(entries: AssetEntry[], apiKey: string): Promise<Record<string, number>> {
  if (entries.length === 0) return {};
  const tickers = Array.from(new Set(entries.map((e) => e.assetId.split('/').pop()!.toUpperCase())));
  const prices = await Promise.all(
    tickers.map(async (ticker) => {
      const resp = await fetch(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`
      );
      if (!resp.ok) throw new Error(`Twelve Data API error: ${resp.status} ${resp.statusText}`);

      const data = await resp.json() as
        | { price: string }
        | { code?: number; message?: string; status?: string };

      if ('price' in data) {
        const parsed = Number(data.price);
        return Number.isFinite(parsed) ? [ticker, parsed] as const : [ticker, undefined] as const;
      }

      if (data.code === 401 || data.status === 'error') {
        throw new Error(`Twelve Data auth/error for ${ticker}: ${data.message ?? 'unknown error'}`);
      }
      return [ticker, undefined] as const;
    })
  );

  const byTicker = new Map(prices.filter((p): p is readonly [string, number] => typeof p[1] === 'number'));
  const result: Record<string, number> = {};
  for (const e of entries) {
    const ticker = e.assetId.split('/').pop()!.toUpperCase();
    const price = byTicker.get(ticker);
    if (typeof price === 'number') result[e.symbol] = price;
  }
  return result;
}

export function useUpdatePrices(onSuccess?: () => void) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updatePrices = useCallback(async () => {
    try {
      setUpdating(true);
      setUpdateError(null);

      const priceTable = await bitable.base.getTable('prices');
      const priceFields = await priceTable.getFieldMetaList();
      const fieldMap = new Map(priceFields.map((f) => [f.name, f.id]));

      const idFieldId     = fieldMap.get('id') ?? fieldMap.get('Id') ?? '';
      const symbolFieldId = fieldMap.get('symbol') ?? fieldMap.get('Symbol') ?? '';
      const priceFieldId  = (() => {
        for (const [name, id] of fieldMap) {
          if (name.toLowerCase().startsWith('price')) return id;
        }
        return '';
      })();
      const updatedFieldId = fieldMap.get('updated') ?? fieldMap.get('Updated') ?? '';

      if (!symbolFieldId || !priceFieldId) {
        throw new Error('Could not find symbol or price field in prices table');
      }

      const todayStart = new Date().setHours(0, 0, 0, 0);

      const resp = await priceTable.getRecords({ pageSize: 5000 });
      const entries: AssetEntry[] = [];

      for (const rec of resp.records) {
        const symbol  = parseTextField(rec.fields[symbolFieldId]);
        const assetId = idFieldId ? parseTextField(rec.fields[idFieldId]) : '';

        if (!symbol || symbol === 'USD') continue;

        // Skip if already updated today
        if (updatedFieldId) {
          const updatedVal = rec.fields[updatedFieldId];
          if (typeof updatedVal === 'number' && updatedVal >= todayStart) continue;
        }

        entries.push({ recordId: rec.recordId, symbol, assetId: assetId || symbol });
      }

      const cryptoEntries = entries.filter((e) => e.symbol.startsWith('$'));
      const stockEntries  = entries.filter((e) => e.assetId.includes('/'));
      const fiatEntries   = entries.filter((e) => !e.symbol.startsWith('$') && !e.assetId.includes('/'));
      const twelveDataApiKey = stockEntries.length > 0
        ? await getSettingValue(['twelvedata.com', 'twelvedata'])
        : '';

      const [cryptoPrices, fiatPrices, stockPrices] = await Promise.all([
        fetchCryptoPrices(cryptoEntries),
        fetchFiatRates(fiatEntries),
        fetchStockPrices(stockEntries, twelveDataApiKey),
      ]);

      const allPrices: Record<string, number> = { ...fiatPrices, ...cryptoPrices, ...stockPrices };
      const now = Date.now();

      const updates = entries
        .filter((e) => allPrices[e.symbol] !== undefined)
        .map((e) => ({
          recordId: e.recordId,
          fields: {
            [priceFieldId]: allPrices[e.symbol],
            ...(updatedFieldId ? { [updatedFieldId]: now } : {}),
          },
        }));

      if (updates.length > 0) {
        await priceTable.setRecords(updates);
      }

      onSuccess?.();
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(false);
    }
  }, [onSuccess]);

  return { updatePrices, updating, updateError };
}
