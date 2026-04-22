import type { bitable } from '@lark-base-open/js-sdk';

type Table = Awaited<ReturnType<typeof bitable.base.getTable>>;
type RawRecord = { recordId?: string; fields: Record<string, unknown> };

/**
 * Parse a Lark Bitable single-select / text field into a plain string.
 * Handles strings, `{ text }` / `{ name }` objects, and arrays of `{ text }`.
 */
export function parseSelect(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    return (o.text ?? o.name ?? '') as string;
  }
  if (Array.isArray(val) && val.length > 0) {
    return (val as Array<{ text?: string }>).map((seg) => seg.text ?? '').join('');
  }
  return '';
}

/**
 * Parse a Lark Bitable multi-select field into an array of option strings.
 * Returns [] for empty / unrecognised values.
 */
export function parseMultiSelect(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return (val as Array<unknown>)
      .map((seg) => {
        if (typeof seg === 'string') return seg;
        if (seg && typeof seg === 'object') {
          const o = seg as Record<string, unknown>;
          return (o.text ?? o.name ?? '') as string;
        }
        return '';
      })
      .filter((s) => s.length > 0);
  }
  if (typeof val === 'string') return val ? [val] : [];
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    const t = (o.text ?? o.name ?? '') as string;
    return t ? [t] : [];
  }
  return [];
}

/** Parse a Lark date field (number or `{ value: number }`) to ms timestamp, or null. */
export function parseDate(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    const v = (val as Record<string, unknown>).value;
    return typeof v === 'number' ? v : null;
  }
  return null;
}

/** Page through every record of a Lark Bitable table. */
export async function fetchAllRecords(table: Table): Promise<RawRecord[]> {
  const all: RawRecord[] = [];
  let pageToken: string | undefined;
  while (true) {
    const resp = await table.getRecords({ pageSize: 5000, pageToken });
    all.push(...resp.records);
    if (!resp.hasMore) break;
    pageToken = resp.pageToken;
  }
  return all;
}
