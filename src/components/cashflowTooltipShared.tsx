import { fmtCurrency } from '../settingStore';

export interface CashflowTooltipRow {
  label: string;
  value: number;
  bold?: boolean;
  /** Sub-line under a category (indented, muted) — drawer detail mode only */
  indent?: boolean;
  /** Level-1 category aggregate (lighter, no divider after) */
  categoryL1?: boolean;
  /** Top border before this row — only major sections (after Cumulative / before Expense) */
  dividerBefore?: boolean;
}

interface CashflowTooltipCardProps {
  title: string;
  rows: CashflowTooltipRow[];
  /** No border/shadow (e.g. inside a drawer) */
  embedded?: boolean;
}

/** Level-1 category: segment before the first `-` (e.g. `sure-m-zy` → `sure`). */
export function cashflowLineCategory(name: string): string {
  const t = name.trim();
  const i = t.indexOf('-');
  return i === -1 ? t : t.slice(0, i);
}

export interface CashflowDetailLine {
  name: string;
  value: number;
}

function mergeDetailsByName(lines: CashflowDetailLine[]): CashflowDetailLine[] {
  const m = new Map<string, number>();
  for (const { name, value } of lines) {
    if (value === 0) continue;
    m.set(name, (m.get(name) ?? 0) + value);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).filter((d) => d.value !== 0);
}

function buildCategorySectionRows(
  lines: CashflowDetailLine[],
  kind: 'income' | 'expense',
  includeLineItems: boolean,
): CashflowTooltipRow[] {
  const merged = mergeDetailsByName(lines);
  type Group = { category: string; total: number; items: CashflowDetailLine[] };
  const byCat = new Map<string, Group>();

  for (const line of merged) {
    const category = cashflowLineCategory(line.name);
    let g = byCat.get(category);
    if (!g) {
      g = { category, total: 0, items: [] };
      byCat.set(category, g);
    }
    g.total += line.value;
    g.items.push(line);
  }

  const groups = [...byCat.values()].filter((g) => g.total !== 0);
  groups.sort((a, b) =>
    kind === 'income' ? b.total - a.total : a.total - b.total,
  );

  for (const g of groups) {
    g.items.sort((x, y) =>
      kind === 'income' ? y.value - x.value : x.value - y.value,
    );
  }

  const out: CashflowTooltipRow[] = [];
  for (const g of groups) {
    out.push({ label: g.category, value: g.total, categoryL1: true });
    if (includeLineItems) {
      for (const it of g.items) {
        out.push({ label: it.name, value: it.value, indent: true });
      }
    }
  }
  return out;
}

/**
 * Tooltip / drawer rows: optional cumulative, Income + lvl1 categories, Expense + lvl1 categories.
 * `includeLineItems: true` adds each cf line under its category (drawer).
 */
export function buildCashflowCategoryTooltipRows(params: {
  details: CashflowDetailLine[];
  cumulative?: number;
  includeLineItems?: boolean;
}): CashflowTooltipRow[] {
  const includeLineItems = params.includeLineItems === true;
  const rows: CashflowTooltipRow[] = [];
  const hasCumulative = params.cumulative !== undefined;

  if (hasCumulative) {
    rows.push({ label: 'Cumulative', value: params.cumulative!, bold: true });
  }

  const incomeLines = params.details.filter((d) => d.value > 0);
  const expenseLines = params.details.filter((d) => d.value < 0);

  const incomeTotal = incomeLines.reduce((a, d) => a + d.value, 0);
  const expenseTotal = expenseLines.reduce((a, d) => a + d.value, 0);

  rows.push({
    label: 'Income',
    value: incomeTotal,
    bold: true,
    dividerBefore: hasCumulative,
  });
  rows.push(...buildCategorySectionRows(incomeLines, 'income', includeLineItems));

  rows.push({
    label: 'Expense',
    value: expenseTotal,
    bold: true,
    dividerBefore: true,
  });
  rows.push(...buildCategorySectionRows(expenseLines, 'expense', includeLineItems));

  return rows.filter(
    (r) =>
      r.value !== 0 ||
      r.label === 'Cumulative' ||
      r.label === 'Income' ||
      r.label === 'Expense',
  );
}

export function CashflowTooltipCard({ title, rows, embedded }: CashflowTooltipCardProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: embedded ? 'none' : '1px solid #d1d5db',
        borderRadius: 8,
        padding: embedded ? 0 : '8px 12px',
        fontSize: 12,
        boxShadow: embedded ? 'none' : '0 6px 18px rgba(15, 23, 42, 0.14)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#111827' }}>
        {title}
      </div>
      {rows.map((r, i) => {
        const isCumulative = r.label.trim() === 'Cumulative';
        const cumulativeColor = r.value >= 0 ? '#16a34a' : '#dc2626';
        const showDivider = r.dividerBefore === true;
        const isCategoryL1 = r.categoryL1 === true;
        const muted = r.indent === true;

        let labelColor: string;
        let valueColor: string;
        if (isCumulative) {
          labelColor = cumulativeColor;
          valueColor = cumulativeColor;
        } else if (muted) {
          labelColor = '#9ca3af';
          valueColor = '#9ca3af';
        } else if (isCategoryL1) {
          labelColor = '#94a3b8';
          valueColor = '#94a3b8';
        } else if (r.bold) {
          labelColor = '#111827';
          valueColor = '#111827';
        } else {
          labelColor = '#6b7280';
          valueColor = '#4b5563';
        }

        const fontWeight = r.bold ? 700 : isCategoryL1 || muted ? 400 : 400;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              lineHeight: '1.6',
              marginTop: showDivider ? 8 : 0,
              paddingTop: showDivider ? 8 : 0,
              borderTop: showDivider ? '1px solid #e5e7eb' : 'none',
              paddingLeft: muted ? 12 : 0,
            }}
          >
            <span
              style={{
                color: labelColor,
                fontWeight,
                fontSize: muted ? 11 : 12,
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                color: valueColor,
                fontWeight,
                fontSize: muted ? 11 : 12,
              }}
            >
              {fmtCurrency({ v: r.value })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
