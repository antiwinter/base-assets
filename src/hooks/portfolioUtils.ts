import type { AssetCategory } from '../types';

/**
 * Categorise an account row for snapshot / portfolio views. Precedence (top wins):
 *   1. account is `debt` or `loan`             → debt
 *   2. account is `stock` or `fund`, or unit looks like a → stock
 *      stock symbol (contains '/', e.g. NASDAQ/ICG)
 *   3. unit starts with '$' (e.g. $BTC) or     → digital
 *      platform.type === `ex`
 *   4. platform.type === `fixed`               → fixed
 *   5. otherwise                               → fiat
 */
export function categorizeAccount(
  account: string,
  unit: string,
  platformType: string,
): AssetCategory {
  const a = account.trim().toLowerCase();
  const u = unit.trim();
  const t = platformType.trim().toLowerCase();
  if (a === 'debt' || a === 'loan') return 'debt';
  if (a === 'stock' || a === 'fund' || u.includes('/')) return 'stock';
  if (u.startsWith('$') || t === 'ex') return 'digital';
  if (t === 'fixed') return 'fixed';
  return 'fiat';
}
