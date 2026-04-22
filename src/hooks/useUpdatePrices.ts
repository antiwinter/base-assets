import { useState, useCallback } from 'react';
import { bitable } from '@lark-base-open/js-sdk';

// Maps the price table symbol names to CoinGecko coin IDs
const COINGECKO_ID: Record<string, string> = {
  '$BTC': 'bitcoin',
  '$ETH': 'ethereum',
  '$BNB': 'binancecoin',
  '$SOL': 'solana',
  '$XRP': 'ripple',
  '$ADA': 'cardano',
  '$DOGE': 'dogecoin',
  '$DOT': 'polkadot',
  '$MATIC': 'matic-network',
  '$AVAX': 'avalanche-2',
};

async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  const needed = symbols.filter((s) => COINGECKO_ID[s]);
  if (needed.length === 0) return {};

  const ids = needed.map((s) => COINGECKO_ID[s]).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CoinGecko API error: ${resp.status} ${resp.statusText}`);
  const data: Record<string, { usd: number }> = await resp.json();

  const result: Record<string, number> = {};
  for (const sym of needed) {
    const coinId = COINGECKO_ID[sym];
    if (data[coinId]?.usd !== undefined) {
      result[sym] = data[coinId].usd;
    }
  }
  return result;
}

async function fetchFiatRates(symbols: string[]): Promise<Record<string, number>> {
  const fiat = symbols.filter((s) => !s.startsWith('$') && s !== 'USD');
  if (fiat.length === 0) return {};

  const resp = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!resp.ok) throw new Error(`Exchange rate API error: ${resp.status} ${resp.statusText}`);
  const data: { result: string; rates: Record<string, number> } = await resp.json();
  if (data.result !== 'success') throw new Error('Exchange rate API returned non-success result');

  const result: Record<string, number> = {};
  for (const sym of fiat) {
    const rate = data.rates[sym];
    if (rate && rate > 0) {
      // Fiat price stored as USD equivalent: 1 CNY = 1/rate USD
      result[sym] = 1 / rate;
    }
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

      const symbolFieldId = fieldMap.get('symbol') ?? fieldMap.get('Symbol') ?? '';
      const priceFieldId = (() => {
        for (const [name, id] of fieldMap) {
          if (name.toLowerCase().startsWith('price')) return id;
        }
        return '';
      })();
      const updatedFieldId = fieldMap.get('updated') ?? fieldMap.get('Updated') ?? '';

      if (!symbolFieldId || !priceFieldId) {
        throw new Error('Could not find symbol or price field in prices table');
      }

      // Fetch all records and collect symbols
      const resp = await priceTable.getRecords({ pageSize: 5000 });
      const recordSymbols: Array<{ recordId: string; symbol: string }> = [];

      for (const rec of resp.records) {
        const symVal = rec.fields[symbolFieldId];
        let symbol = '';
        if (typeof symVal === 'string') {
          symbol = symVal;
        } else if (symVal && typeof symVal === 'object' && !Array.isArray(symVal)) {
          const o = symVal as Record<string, unknown>;
          symbol = (o.text ?? o.name ?? '') as string;
        } else if (Array.isArray(symVal) && symVal.length > 0) {
          symbol = (symVal as Array<{ text?: string }>).map((seg) => seg.text ?? '').join('');
        }

        if (symbol && symbol !== 'USD') {
          recordSymbols.push({ recordId: rec.recordId, symbol });
        }
      }

      const allSymbols = recordSymbols.map((r) => r.symbol);

      // Fetch prices from both sources in parallel
      const [cryptoPrices, fiatPrices] = await Promise.all([
        fetchCryptoPrices(allSymbols),
        fetchFiatRates(allSymbols),
      ]);

      const allPrices: Record<string, number> = { ...fiatPrices, ...cryptoPrices };
      const now = Date.now();

      const updates = recordSymbols
        .filter((r) => allPrices[r.symbol] !== undefined)
        .map((r) => ({
          recordId: r.recordId,
          fields: {
            [priceFieldId]: allPrices[r.symbol],
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
