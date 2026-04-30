import { bitable } from '@lark-base-open/js-sdk';
import { fetchAllRecords, parseSelect, parseMultiSelect, parseDate } from './larkUtils';
import { epiRemainingPrincipal } from '../cf-drivers/epi';
import { epiTermMonthsFromStartEnd } from '../cf-drivers/scheduleUtils';
import type { CashFlowItem, SnapshotAccount } from '../types';

export interface AccountInfo {
  platform: string;
  type: string;            // bank / webfi / ex / broker / fixed
  subAccounts: string[];   // values from the `accounts` multi-select column
}

export interface SnapshotEntry {
  type: string;            // bank / webfi / ex / broker / fixed (from accounts table)
  platform: string;
  account: string;         // "" for main balance, else sub-account name
  balance: number;         // default 0
  unit: string;            // auto-detected currency / symbol
}

export interface ExistingEntry {
  recordId: string;
  balance: number;
}

export interface EditorMeta {
  accounts: AccountInfo[];
  /** Most recent unit observed for `(platform, account)` in the data table. */
  detectUnit: (platform: string, account: string, type: string) => string;
  /**
   * Existing data rows indexed by `${dayMs}|${platform}|${account}` so the
   * caller can decide between "insert new" / "update default" / "leave alone".
   */
  existingByKey: Map<string, ExistingEntry>;
}

/** Compose the lookup key used by `existingByKey`. `dayMs` must be day-aligned. */
export function existingKey(dayMs: number, platform: string, account: string): string {
  return `${dayMs}|${platform}|${account}`;
}

function pickDefaultUnit(type: string): string {
  const t = type.toLowerCase();
  if (t === 'ex') return '$BTC';
  return 'CNY';
}

/** Day-aligned ms timestamp for today (local time). */
export function todayDayMs(): number {
  return new Date().setHours(0, 0, 0, 0);
}

/**
 * Parse `cfi` table records into EPI `CashFlowItem`s (valid start/end, computed term, platform).
 */
export function parseEpiCashFlowItems(
  records: Array<{ fields: Record<string, unknown> }>,
  fieldMap: Map<string, string>,
): CashFlowItem[] {
  const driverFieldId = fieldMap.get('driver') ?? '';
  const amountFieldId = fieldMap.get('amount') ?? '';
  const aprFieldId = fieldMap.get('apr') ?? '';
  const startFieldId = fieldMap.get('start') ?? fieldMap.get('Start') ?? '';
  const endFieldId = fieldMap.get('end') ?? '';
  const accountsFieldId = fieldMap.get('accounts') ?? '';
  const itemFieldId = fieldMap.get('item') ?? '';
  const unitFieldId = fieldMap.get('unit') ?? '';

  if (!driverFieldId || !amountFieldId || !accountsFieldId) return [];

  const out: CashFlowItem[] = [];
  for (const rec of records) {
    const driver = parseSelect(rec.fields[driverFieldId]);
    if (driver !== 'EPI') continue;

    const platform = parseSelect(rec.fields[accountsFieldId]);
    if (!platform) continue;

    const start = startFieldId ? parseDate(rec.fields[startFieldId]) : null;
    const end = parseDate(rec.fields[endFieldId]);
    if (start == null || end == null) continue;

    const term = epiTermMonthsFromStartEnd(start, end);
    if (term <= 0) continue;

    const amount = typeof rec.fields[amountFieldId] === 'number' ? rec.fields[amountFieldId] as number : 0;
    const apr = typeof rec.fields[aprFieldId] === 'number' ? rec.fields[aprFieldId] as number : 0;

    out.push({
      item: itemFieldId ? parseSelect(rec.fields[itemFieldId]) : '',
      driver: 'EPI',
      amount,
      unit: unitFieldId ? parseSelect(rec.fields[unitFieldId]) : '',
      apr,
      start,
      end,
      term,
      accounts: platform,
    });
  }
  return out;
}

/** One synthetic debt row per EPI line with remaining principal at `dateMs` (APR from CFI for treemap heat). */
export function epiLoanSnapshotAccountsForDate(
  epiItems: CashFlowItem[],
  dateMs: number,
  priceMap: Map<string, number>,
): SnapshotAccount[] {
  const accounts: SnapshotAccount[] = [];
  const unnamedCountByPlatform = new Map<string, number>();
  for (const item of epiItems) {
    const remaining = epiRemainingPrincipal(item, dateMs);
    if (remaining <= 0) continue;
    const platform = item.accounts.trim();
    if (!platform) continue;
    const unit = item.unit.trim() || 'CNY';
    const balance = -remaining;
    const price = priceMap.get(unit) ?? 0;
    const valueUsd = balance * price;
    const itemName = item.item.trim();
    let account: string;
    if (itemName) {
      account = itemName;
    } else {
      const n = (unnamedCountByPlatform.get(platform) ?? 0) + 1;
      unnamedCountByPlatform.set(platform, n);
      account = n === 1 ? 'loan' : `loan (${n})`;
    }
    const aprPercent =
      typeof item.apr === 'number' && Number.isFinite(item.apr) ? item.apr : 0;
    accounts.push({
      platform,
      account,
      balance,
      unit,
      valueUsd,
      category: 'debt',
      aprPercent,
    });
  }
  return accounts;
}

/**
 * Load the metadata needed to seed a fresh snapshot:
 *  - the list of accounts (platform / type / sub-accounts) from the `accounts` table,
 *    excluding rows whose single-select `status` is `deprecated`
 *  - a `detectUnit` resolver based on the most recent unit per (platform, account)
 *    in the `data` table
 */
export async function loadEditorMeta(): Promise<EditorMeta> {
  const accountsTable = await bitable.base.getTable('accounts');
  const dataTable = await bitable.base.getTable('data');

  const acctFields = await accountsTable.getFieldMetaList();
  const dataFields = await dataTable.getFieldMetaList();

  const acctMap = new Map(acctFields.map((f) => [f.name, f.id]));
  const dataMap = new Map(dataFields.map((f) => [f.name, f.id]));

  const acctPlatformId = acctMap.get('platform') ?? acctMap.get('Platform') ?? '';
  const acctTypeId = acctMap.get('type') ?? acctMap.get('Type') ?? '';
  const acctSubId = acctMap.get('accounts') ?? acctMap.get('Accounts') ?? '';
  const acctStatusId = acctMap.get('status') ?? acctMap.get('Status') ?? '';

  const dataDateId = dataMap.get('Date') ?? dataMap.get('date') ?? '';
  const dataPlatformId = dataMap.get('platform') ?? dataMap.get('Platform') ?? '';
  const dataAccountId = dataMap.get('account') ?? dataMap.get('Account') ?? '';
  const dataUnitId = dataMap.get('Unit') ?? dataMap.get('unit') ?? '';
  const dataBalanceId = dataMap.get('Balance') ?? dataMap.get('balance') ?? '';

  const [acctRecords, dataRecords] = await Promise.all([
    fetchAllRecords(accountsTable),
    fetchAllRecords(dataTable),
  ]);

  const accounts: AccountInfo[] = [];
  for (const rec of acctRecords) {
    const platform = parseSelect(rec.fields[acctPlatformId]);
    if (!platform) continue;
    if (acctStatusId) {
      const status = parseSelect(rec.fields[acctStatusId]);
      if (status.toLowerCase() === 'deprecated') continue;
    }
    const type = parseSelect(rec.fields[acctTypeId]);
    const subAccounts = acctSubId ? parseMultiSelect(rec.fields[acctSubId]) : [];
    accounts.push({ platform, type, subAccounts });
  }
  accounts.sort((a, b) => {
    const tc = a.type.localeCompare(b.type);
    if (tc !== 0) return tc;
    return a.platform.localeCompare(b.platform);
  });

  const latest = new Map<string, { date: number; unit: string }>();
  const existingByKey = new Map<string, ExistingEntry>();
  for (const rec of dataRecords) {
    const platform = parseSelect(rec.fields[dataPlatformId]);
    if (!platform) continue;
    const account = parseSelect(rec.fields[dataAccountId]);
    const unit = parseSelect(rec.fields[dataUnitId]);
    const dateMs = parseDate(rec.fields[dataDateId]) ?? 0;
    if (!dateMs) continue;
    const dayMs = new Date(dateMs).setHours(0, 0, 0, 0);

    if (unit) {
      const key = `${platform}|${account}`;
      const cur = latest.get(key);
      if (!cur || dayMs > cur.date) latest.set(key, { date: dayMs, unit });
    }

    const recordId = rec.recordId;
    if (recordId) {
      const balance = dataBalanceId && typeof rec.fields[dataBalanceId] === 'number'
        ? (rec.fields[dataBalanceId] as number)
        : 0;
      existingByKey.set(existingKey(dayMs, platform, account), { recordId, balance });
    }
  }

  const detectUnit = (platform: string, account: string, type: string): string => {
    const cur = latest.get(`${platform}|${account}`);
    return cur?.unit ?? pickDefaultUnit(type);
  };

  return { accounts, detectUnit, existingByKey };
}

/** Lexicographic order: type → platform → account (empty account sorts before named sub-accounts). */
export function compareSnapshotEntries(a: SnapshotEntry, b: SnapshotEntry): number {
  const tc = a.type.localeCompare(b.type);
  if (tc !== 0) return tc;
  const pc = a.platform.localeCompare(b.platform);
  if (pc !== 0) return pc;
  return a.account.localeCompare(b.account);
}

/** Build a fresh entry list from accounts metadata (one main row per platform + one per sub-account). */
export function buildFreshEntries(
  accounts: AccountInfo[],
  detectUnit: (platform: string, account: string, type: string) => string,
): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const a of accounts) {
    entries.push({
      type: a.type,
      platform: a.platform,
      account: '',
      balance: 0,
      unit: detectUnit(a.platform, '', a.type),
    });
    for (const sub of a.subAccounts) {
      entries.push({
        type: a.type,
        platform: a.platform,
        account: sub,
        balance: 0,
        unit: detectUnit(a.platform, sub, a.type),
      });
    }
  }
  return entries;
}
