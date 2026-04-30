import type { Snapshot, SnapshotAccount } from '../types';

const YEAR_MS = 365 * 86400_000;
/** Letter then trailing percent (e.g. earn1.35 → 1.35); avoids `loan (2)` etc. */
const APY_SUFFIX_RE = /[a-zA-Z](\d+(?:\.\d+)?)$/;

/** Suffix APY on account name (e.g. earn1.35 → 1.35, flex2.5 → 2.5). */
export function parseSuffixApyPercent(account: string): number | null {
  const t = account.trim();
  const m = t.match(APY_SUFFIX_RE);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v) || v <= 0 || v > 100) return null;
  return v;
}

/** Lowercase, trim, remove spaces — e.g. "Ant Marco" → "antmarco", "OKX" → "okx". */
function nameSegment(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

/** Tooltip / breakdown key: `interest-okx-earn1.35`. */
export function interestBreakdownKey(platform: string, account: string): string {
  return `interest-${nameSegment(platform)}-${nameSegment(account)}`;
}

function sameRow(a: SnapshotAccount, platform: string, account: string): boolean {
  return a.platform.trim() === platform.trim() && a.account.trim() === account.trim();
}

/** Last millisecond of calendar month (month is 1–12). */
function monthEndLocalMs(year: number, month: number): number {
  const d = new Date(year, month, 0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Rightmost index with snapshots[i].date <= atOrBefore, or -1. */
function latestSnapshotIndexAtOrBefore(snapshots: Snapshot[], atOrBefore: number): number {
  let lo = 0;
  let hi = snapshots.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].date <= atOrBefore) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Distinct earn-style rows (platform + account) with a unit for FX. */
function collectEarnLines(snapshots: Snapshot[]): { platform: string; account: string; unit: string }[] {
  const byKey = new Map<string, { platform: string; account: string; unit: string }>();
  for (const s of snapshots) {
    for (const a of s.accounts) {
      if (parseSuffixApyPercent(a.account) == null || !a.unit) continue;
      const k = `${a.platform.trim()}\0${a.account.trim()}`;
      if (!byKey.has(k)) {
        byKey.set(k, { platform: a.platform.trim(), account: a.account.trim(), unit: a.unit });
      }
    }
  }
  return [...byKey.values()];
}

function interestForMonth(
  principal: number,
  apyPercent: number,
  year: number,
  month: number,
): number {
  const d = daysInMonth(year, month);
  return principal * (apyPercent / 100) * ((d * 86400_000) / YEAR_MS);
}

function depositInterestForRow(
  snapshots: Snapshot[],
  platform: string,
  account: string,
  year: number,
  month: number,
): number {
  const cutoff = monthEndLocalMs(year, month);
  const idx = latestSnapshotIndexAtOrBefore(snapshots, cutoff);
  if (idx < 0) return 0;

  const snap = snapshots[idx];
  const row = snap.accounts.find((a) => sameRow(a, platform, account));
  if (!row || row.balance <= 0) return 0;
  const apy = parseSuffixApyPercent(row.account);
  if (apy == null) return 0;
  return interestForMonth(row.balance, apy, year, month);
}

function convRateForUnit(
  unit: string,
  rate: number,
  prices: Map<string, number>,
): number {
  const cnyPriceUsd = prices.get('CNY') || 0.15;
  const displayingCny = rate !== 1;
  const unitPriceUsd = prices.get(unit) ?? 1;
  return displayingCny ? unitPriceUsd / cnyPriceUsd : unitPriceUsd;
}

/**
 * One driver per earn row (platform + account). Breakdown keys look like
 * `interest-okx-earn1.35` so tooltips aggregate per line. Uses latest snapshot
 * with date <= end of that month.
 */
export function buildDepositInterestDriversWithRates(
  snapshots: Snapshot[],
  rate: number,
  prices: Map<string, number>,
): { getMonthBreakdown: (year: number, month: number) => Record<string, number>; convRate: number }[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.date - b.date);
  const lines = collectEarnLines(sorted);
  if (lines.length === 0) return [];

  const list: { getMonthBreakdown: (year: number, month: number) => Record<string, number>; convRate: number }[] =
    [];
  for (const { platform, account, unit } of lines) {
    const lineName = interestBreakdownKey(platform, account);
    const convRate = convRateForUnit(unit, rate, prices);
    list.push({
      convRate,
      getMonthBreakdown(year: number, month: number): Record<string, number> {
        const raw = depositInterestForRow(sorted, platform, account, year, month);
        if (raw === 0) return {};
        return { [lineName]: raw };
      },
    });
  }
  return list;
}
