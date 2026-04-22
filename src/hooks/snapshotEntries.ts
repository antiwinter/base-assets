import { bitable } from '@lark-base-open/js-sdk';
import { fetchAllRecords, parseSelect, parseMultiSelect } from './larkUtils';

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

export interface EditorMeta {
  accounts: AccountInfo[];
  /** Most recent unit observed for `(platform, account)` in the data table. */
  detectUnit: (platform: string, account: string, type: string) => string;
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

  const [acctRecords, dataRecords] = await Promise.all([
    fetchAllRecords(accountsTable),
    fetchAllRecords(dataTable),
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

  // Build (platform|account) -> latest unit map
  const latest = new Map<string, { date: number; unit: string }>();
  for (const rec of dataRecords) {
    const platform = parseSelect(rec.fields[dataPlatformId]);
    const account = parseSelect(rec.fields[dataAccountId]);
    const unit = parseSelect(rec.fields[dataUnitId]);
    if (!platform || !unit) continue;
    const dateRaw = rec.fields[dataDateId];
    let date = 0;
    if (typeof dateRaw === 'number') date = dateRaw;
    else if (dateRaw && typeof dateRaw === 'object' && 'value' in (dateRaw as Record<string, unknown>)) {
      date = (dateRaw as Record<string, unknown>).value as number;
    }
    const key = `${platform}|${account}`;
    const cur = latest.get(key);
    if (!cur || date > cur.date) latest.set(key, { date, unit });
  }

  const detectUnit = (platform: string, account: string, type: string): string => {
    const cur = latest.get(`${platform}|${account}`);
    return cur?.unit ?? pickDefaultUnit(type);
  };

  return { accounts, detectUnit };
}

/** Build a fresh entry list from accounts metadata (one main row per platform + one per sub-account). */
export function buildFreshEntries(
  accounts: AccountInfo[],
  detectUnit: (platform: string, account: string, type: string) => string,
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
      entries.push({
        platform: a.platform,
        account: sub,
        balance: 0,
        unit: detectUnit(a.platform, sub, a.type),
      });
    }
  }
  return entries;
}
