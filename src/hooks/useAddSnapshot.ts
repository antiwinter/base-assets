import { useState, useCallback } from 'react';
import {
  bitable,
  type ISingleSelectField,
  type IOpenSingleSelect,
  type IRecordValue,
} from '@lark-base-open/js-sdk';
import {
  loadEditorMeta,
  buildFreshEntries,
  compareSnapshotEntries,
  todayDayMs,
  existingKey,
  type SnapshotEntry,
  type ExistingEntry,
} from './snapshotEntries';

/**
 * Resolve a single-select field: load its options, then for any input value not
 * already present as an option, call `addOption(value)`. Returns a value→option
 * map that can be used to write `IOpenSingleSelect` values into a record.
 */
async function ensureOptions(
  field: ISingleSelectField,
  values: Iterable<string>,
): Promise<Map<string, IOpenSingleSelect>> {
  const existing = await field.getOptions();
  const byName = new Map<string, IOpenSingleSelect>();
  for (const opt of existing) byName.set(opt.name, { id: opt.id, text: opt.name });

  const wanted = new Set<string>();
  for (const v of values) if (v) wanted.add(v);
  const missing = Array.from(wanted).filter((v) => !byName.has(v));
  if (missing.length > 0) {
    for (const name of missing) {
      await field.addOption(name);
    }
    const refreshed = await field.getOptions();
    byName.clear();
    for (const opt of refreshed) byName.set(opt.name, { id: opt.id, text: opt.name });
  }
  return byName;
}

interface PendingUpdate {
  recordId: string;
  newBalance: number;
}

/**
 * Decide what to do with each fresh entry given the existing data rows for the
 * same date:
 *   - no existing row              → insert
 *   - existing balance == 0 and    → update (refresh default zero rows)
 *     entry.balance != 0
 *   - otherwise                     → skip
 */
function partition(
  entries: SnapshotEntry[],
  date: number,
  existingByKey: Map<string, ExistingEntry>,
): { toInsert: SnapshotEntry[]; toUpdate: PendingUpdate[] } {
  const toInsert: SnapshotEntry[] = [];
  const toUpdate: PendingUpdate[] = [];
  for (const e of entries) {
    const existing = existingByKey.get(existingKey(date, e.platform, e.account));
    if (!existing) {
      toInsert.push(e);
    } else if (existing.balance === 0 && e.balance !== 0) {
      toUpdate.push({ recordId: existing.recordId, newBalance: e.balance });
    }
  }
  return { toInsert, toUpdate };
}

export function useAddSnapshot(onSuccess?: () => void) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSnapshot = useCallback(async () => {
    try {
      setAdding(true);
      setError(null);

      const { accounts, detectUnit, existingByKey: existingMap } = await loadEditorMeta();
      if (accounts.length === 0) throw new Error('No accounts found in the accounts table.');

      const date = todayDayMs();
      const entries = buildFreshEntries(accounts, detectUnit);
      const { toInsert: toInsertUnsorted, toUpdate } = partition(entries, date, existingMap);
      const toInsert = [...toInsertUnsorted].sort(compareSnapshotEntries);

      if (toInsert.length === 0 && toUpdate.length === 0) {
        window.alert(
          `No changes for ${new Date(date).toLocaleDateString()} — every account already has a non-zero entry.`,
        );
        return;
      }

      const dateLabel = new Date(date).toLocaleDateString();
      const ok = window.confirm(
        `For ${dateLabel}: insert ${toInsert.length} new entries and update ${toUpdate.length} default values. Continue?`,
      );
      if (!ok) return;

      const dataTable = await bitable.base.getTable('data');
      const fieldsMeta = await dataTable.getFieldMetaList();
      const fieldIdByName = new Map(fieldsMeta.map((f) => [f.name, f.id]));

      const dateFieldId = fieldIdByName.get('Date') ?? fieldIdByName.get('date') ?? '';
      const platformFieldId = fieldIdByName.get('platform') ?? fieldIdByName.get('Platform') ?? '';
      const accountFieldId = fieldIdByName.get('account') ?? fieldIdByName.get('Account') ?? '';
      const balanceFieldId = fieldIdByName.get('Balance') ?? fieldIdByName.get('balance') ?? '';
      const unitFieldId = fieldIdByName.get('Unit') ?? fieldIdByName.get('unit') ?? '';

      if (!dateFieldId || !platformFieldId || !balanceFieldId || !unitFieldId) {
        throw new Error('Could not resolve required fields on data table (date/platform/balance/unit).');
      }

      // ---- Inserts ----
      if (toInsert.length > 0) {
        // Single-select fields require IOpenSingleSelect ({id, text}) values, so
        // resolve each option name to its id (creating new options on the fly if
        // the value doesn't already exist as an option).
        const platformField = await dataTable.getFieldById<ISingleSelectField>(platformFieldId);
        const unitField = await dataTable.getFieldById<ISingleSelectField>(unitFieldId);
        const accountField = accountFieldId
          ? await dataTable.getFieldById<ISingleSelectField>(accountFieldId)
          : null;

        const [platformOptions, unitOptions, accountOptions] = await Promise.all([
          ensureOptions(platformField, toInsert.map((e) => e.platform)),
          ensureOptions(unitField, toInsert.map((e) => e.unit)),
          accountField
            ? ensureOptions(accountField, toInsert.map((e) => e.account).filter(Boolean))
            : Promise.resolve(new Map<string, IOpenSingleSelect>()),
        ]);

        const rows: IRecordValue[] = toInsert.map((e) => {
          const fields: Record<string, unknown> = {
            [dateFieldId]: date,
            [balanceFieldId]: e.balance,
          };
          const platformOpt = platformOptions.get(e.platform);
          if (platformOpt) fields[platformFieldId] = platformOpt;
          const unitOpt = unitOptions.get(e.unit);
          if (unitOpt) fields[unitFieldId] = unitOpt;
          if (accountField && e.account) {
            const accOpt = accountOptions.get(e.account);
            if (accOpt) fields[accountFieldId] = accOpt;
          }
          return { fields } as IRecordValue;
        });

        await dataTable.addRecords(rows);
      }

      // ---- Updates (only the balance field) ----
      if (toUpdate.length > 0) {
        const updates = toUpdate.map((u) => ({
          recordId: u.recordId,
          fields: { [balanceFieldId]: u.newBalance } as Record<string, unknown>,
        }));
        await dataTable.setRecords(updates as unknown as Parameters<typeof dataTable.setRecords>[0]);
      }

      try {
        await bitable.ui.switchToTable(dataTable.id);
      } catch {
        // switching the host UI is best-effort; ignore failures
      }

      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }, [onSuccess]);

  return { addSnapshot, adding, error };
}
