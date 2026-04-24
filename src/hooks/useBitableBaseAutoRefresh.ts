import { useEffect, useCallback, useRef } from 'react';
import { bitable, WidgetTableEvent } from '@lark-base-open/js-sdk';

/** Debounce delay after record add/modify/delete before refetching from Base. */
export const BITABLE_RECORD_REFRESH_DEBOUNCE_MS = 400;

const TABLE_RECORD_EVENTS = [
  WidgetTableEvent.RecordAdd,
  WidgetTableEvent.RecordModify,
  WidgetTableEvent.RecordDelete,
] as const;

type BitableTable = Awaited<ReturnType<typeof bitable.base.getTable>>;

/** Tables whose rows feed the snapshot view (data + prices + platform types). */
export const SNAPSHOT_REFRESH_TABLES = ['accounts', 'prices', 'data'] as const;

/** Tables whose rows feed cashflow charts (cfi + prices; accounts for shared pricing / future use). */
export const CASHFLOW_REFRESH_TABLES = ['accounts', 'prices', 'cfi'] as const;

const SNAPSHOT_TABLE_SET = new Set<string>(SNAPSHOT_REFRESH_TABLES);
const CASHFLOW_TABLE_SET = new Set<string>(CASHFLOW_REFRESH_TABLES);

async function unregisterRecordEvents(tables: BitableTable[]): Promise<void> {
  await Promise.all(
    tables.flatMap((t) =>
      TABLE_RECORD_EVENTS.map((ev) => t.unregisterTableEvent(ev).catch(() => {})),
    ),
  );
}

function uniqueTableNames(
  a: readonly string[],
  b: readonly string[],
): string[] {
  return Array.from(new Set([...a, ...b]));
}

export interface BitableBaseAutoRefreshOptions {
  /** Called (debounced) when accounts, prices, or data rows change. */
  reloadSnapshot: () => void;
  /** Called (debounced) when accounts, prices, or cfi rows change. */
  reloadCashflow: () => void;
  debounceMs?: number;
}

/**
 * One subscription per Base table (Lark allows at most one client listener per table event).
 * Routes record changes to snapshot vs cashflow reloads by table dependency.
 */
export function useBitableBaseAutoRefresh({
  reloadSnapshot,
  reloadCashflow,
  debounceMs = BITABLE_RECORD_REFRESH_DEBOUNCE_MS,
}: BitableBaseAutoRefreshOptions): void {
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSnapshot = useCallback(() => {
    if (snapTimerRef.current != null) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null;
      reloadSnapshot();
    }, debounceMs);
  }, [reloadSnapshot, debounceMs]);

  const scheduleCashflow = useCallback(() => {
    if (cfTimerRef.current != null) clearTimeout(cfTimerRef.current);
    cfTimerRef.current = setTimeout(() => {
      cfTimerRef.current = null;
      reloadCashflow();
    }, debounceMs);
  }, [reloadCashflow, debounceMs]);

  useEffect(() => {
    let cancelled = false;
    let disposeListeners: (() => void) | null = null;

    const allNames = uniqueTableNames(SNAPSHOT_REFRESH_TABLES, CASHFLOW_REFRESH_TABLES);

    void (async () => {
      const registered: BitableTable[] = [];
      try {
        const tablesWithNames: { name: string; table: BitableTable }[] = [];

        for (const tableName of allNames) {
          const t = await bitable.base.getTable(tableName);
          if (cancelled) {
            await unregisterRecordEvents(registered);
            return;
          }
          for (const ev of TABLE_RECORD_EVENTS) {
            await t.registerTableEvent(ev);
          }
          registered.push(t);
          tablesWithNames.push({ name: tableName, table: t });
        }

        if (cancelled) {
          await unregisterRecordEvents(registered);
          return;
        }

        const unsubs: Array<() => void> = [];
        for (const { name, table: t } of tablesWithNames) {
          const onEvent = () => {
            if (SNAPSHOT_TABLE_SET.has(name)) scheduleSnapshot();
            if (CASHFLOW_TABLE_SET.has(name)) scheduleCashflow();
          };
          unsubs.push(
            t.onRecordAdd(onEvent),
            t.onRecordModify(onEvent),
            t.onRecordDelete(onEvent),
          );
        }

        if (cancelled) {
          for (const u of unsubs) u();
          await unregisterRecordEvents(registered);
          return;
        }

        disposeListeners = () => {
          for (const u of unsubs) u();
          void unregisterRecordEvents(registered);
        };
      } catch {
        await unregisterRecordEvents(registered);
      }
    })();

    return () => {
      cancelled = true;
      if (snapTimerRef.current != null) {
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current = null;
      }
      if (cfTimerRef.current != null) {
        clearTimeout(cfTimerRef.current);
        cfTimerRef.current = null;
      }
      disposeListeners?.();
    };
  }, [scheduleSnapshot, scheduleCashflow]);
}
