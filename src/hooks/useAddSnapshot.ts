import { useState, useCallback } from 'react';
import { bitable, type IRecordValue } from '@lark-base-open/js-sdk';
import { loadEditorMeta, buildFreshEntries, todayDayMs } from './snapshotEntries';

export function useAddSnapshot(onSuccess?: () => void) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSnapshot = useCallback(async () => {
    try {
      setAdding(true);
      setError(null);

      const { accounts, detectUnit } = await loadEditorMeta();
      if (accounts.length === 0) throw new Error('No accounts found in the accounts table.');

      const date = todayDayMs();
      const entries = buildFreshEntries(accounts, detectUnit);

      const ok = window.confirm(
        `Add ${entries.length} entries dated ${new Date(date).toLocaleDateString()} to the data table?`,
      );
      if (!ok) return;

      const dataTable = await bitable.base.getTable('data');
      const fields = await dataTable.getFieldMetaList();
      const fieldMap = new Map(fields.map((f) => [f.name, f.id]));

      const dateFieldId = fieldMap.get('Date') ?? fieldMap.get('date') ?? '';
      const platformFieldId = fieldMap.get('platform') ?? fieldMap.get('Platform') ?? '';
      const accountFieldId = fieldMap.get('account') ?? fieldMap.get('Account') ?? '';
      const balanceFieldId = fieldMap.get('Balance') ?? fieldMap.get('balance') ?? '';
      const unitFieldId = fieldMap.get('Unit') ?? fieldMap.get('unit') ?? '';

      if (!dateFieldId || !platformFieldId || !balanceFieldId || !unitFieldId) {
        throw new Error('Could not resolve required fields on data table (date/platform/balance/unit).');
      }

      const rows = entries.map((e) => {
        const row: Record<string, unknown> = {
          [dateFieldId]: date,
          [platformFieldId]: e.platform,
          [balanceFieldId]: e.balance,
          [unitFieldId]: e.unit,
        };
        if (accountFieldId && e.account) row[accountFieldId] = e.account;
        return { fields: row };
      });

      // The Lark SDK accepts plain strings for single-select option writes at runtime;
      // the static IRecordValue type expects IOpenSingleSelect objects, so we cast.
      await dataTable.addRecords(rows as unknown as IRecordValue[]);

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
