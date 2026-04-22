import { bitable } from '@lark-base-open/js-sdk';
import { fetchAllRecords, parseSelect, parseMultiSelect, parseDate } from './larkUtils';
import { epiRemainingPrincipal } from '../cf-drivers/epi';
import type { CashFlowItem } from '../types';

export interface AccountInfo {
  platform: string;
  type: string;            // bank / webfi / ex / broker / fixed
  subAccounts: string[];   // values from the `accounts` multi-select column
}

export interface SnapshotEntry {
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
   * Sum of remaining EPI principal per platform, already negated so the value
   * can be dropped directly into the `loan` sub-account's balance.
   */
  epiLoanByPlatform: Map<string, number>;
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
 * Load the metadata needed to seed a fresh snapshot:
 *  - the list of accounts (platform / type / sub-accounts) from the `accounts` table
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

  const dataDateId = dataMap.get('Date') ?? dataMap.get('date') ?? '';
  const dataPlatformId = dataMap.get('platform') ?? dataMap.get('Platform') ?? '';
  const dataAccountId = dataMap.get('account') ?? dataMap.get('Account') ?? '';
  const dataUnitId = dataMap.get('Unit') ?? dataMap.get('unit') ?? '';
  const dataBalanceId = dataMap.get('Balance') ?? dataMap.get('balance') ?? '';

  const [acctRecords, dataRecords, epiLoanByPlatform] = await Promise.all([
    fetchAllRecords(accountsTable),
    fetchAllRecords(dataTable),
    loadEpiLoanByPlatform(todayDayMs()),
  ]);

  const accounts: AccountInfo[] = [];
  for (const rec of acctRecords) {
    const platform = parseSelect(rec.fields[acctPlatformId]);
    if (!platform) continue;
    const type = parseSelect(rec.fields[acctTypeId]);
    const subAccounts = acctSubId ? parseMultiSelect(rec.fields[acctSubId]) : [];
    accounts.push({ platform, type, subAccounts });
  }
  accounts.sort((a, b) => a.platform.localeCompare(b.platform));

  // Walk data records once to build:
  //   - `latest`: most recent unit per (platform, account) for unit detection
  //   - `existingByKey`: per-day index used to decide insert vs update vs skip
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

  return { accounts, detectUnit, epiLoanByPlatform, existingByKey };
}

/**
 * Load EPI cashflow items from the `cfi` table and produce a map of
 * `platform -> -sum(remainingPrincipal)` as of `asOf`. Returns an empty map
 * (without throwing) if the table is missing or has no qualifying rows.
 */
async function loadEpiLoanByPlatform(asOf: number): Promise<Map<string, number>> {
  try {
    const cfiTable = await bitable.base.getTable('cfi');
    const cfiFields = await cfiTable.getFieldMetaList();
    const fieldMap = new Map(cfiFields.map((f) => [f.name, f.id]));

    const driverFieldId = fieldMap.get('driver') ?? '';
    const amountFieldId = fieldMap.get('amount') ?? '';
    const rateFieldId = fieldMap.get('rate') ?? '';
    const endFieldId = fieldMap.get('end') ?? '';
    const termFieldId = fieldMap.get('term') ?? '';
    const accountsFieldId = fieldMap.get('accounts') ?? '';
    const itemFieldId = fieldMap.get('item') ?? '';
    const unitFieldId = fieldMap.get('unit') ?? '';

    if (!driverFieldId || !amountFieldId || !accountsFieldId) return new Map();

    const records = await fetchAllRecords(cfiTable);
    const totals = new Map<string, number>();
    for (const rec of records) {
      const driver = parseSelect(rec.fields[driverFieldId]);
      if (driver !== 'EPI') continue;

      const platform = parseSelect(rec.fields[accountsFieldId]);
      if (!platform) continue;

      const amount = typeof rec.fields[amountFieldId] === 'number' ? rec.fields[amountFieldId] as number : 0;
      const rate = typeof rec.fields[rateFieldId] === 'number' ? rec.fields[rateFieldId] as number : 0;
      const term = typeof rec.fields[termFieldId] === 'number' ? rec.fields[termFieldId] as number : 0;
      const end = parseDate(rec.fields[endFieldId]);
      if (!end || !term) continue;

      const item: CashFlowItem = {
        item: itemFieldId ? parseSelect(rec.fields[itemFieldId]) : '',
        driver: 'EPI',
        amount,
        unit: unitFieldId ? parseSelect(rec.fields[unitFieldId]) : '',
        rate,
        end,
        term,
        accounts: platform,
      };

      const remaining = epiRemainingPrincipal(item, asOf);
      if (remaining <= 0) continue;
      totals.set(platform, (totals.get(platform) ?? 0) - remaining);
    }
    return totals;
  } catch {
    return new Map();
  }
}

/** Build a fresh entry list from accounts metadata (one main row per platform + one per sub-account). */
export function buildFreshEntries(
  accounts: AccountInfo[],
  detectUnit: (platform: string, account: string, type: string) => string,
  epiLoanByPlatform: Map<string, number> = new Map(),
): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const a of accounts) {
    entries.push({
      platform: a.platform,
      account: '',
      balance: 0,
      unit: detectUnit(a.platform, '', a.type),
    });
    for (const sub of a.subAccounts) {
      const isLoan = sub.toLowerCase() === 'loan';
      const epiBalance = isLoan ? epiLoanByPlatform.get(a.platform) : undefined;
      entries.push({
        platform: a.platform,
        account: sub,
        balance: typeof epiBalance === 'number' ? epiBalance : 0,
        unit: detectUnit(a.platform, sub, a.type),
      });
    }
  }
  return entries;
}
