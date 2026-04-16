import type { Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  symbol: string;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function fmtHuman(v: number, sym: string): { symbol: string; number: string } {
  const abs = Math.abs(v);
  let number: string;
  if (abs >= 1_000_000) number = `${(v / 1_000_000).toFixed(2)}m`;
  else if (abs >= 1_000) number = `${(v / 1_000).toFixed(1)}k`;
  else number = v.toFixed(2);
  return { symbol: sym, number };
}

function pctChange(cur: number, prev: number): { arrow: string; pct: string; positive: boolean } | null {
  if (prev === 0) return null;
  const change = ((cur - prev) / Math.abs(prev)) * 100;
  const positive = change >= 0;
  return {
    arrow: positive ? '↑' : '↓',
    pct: `${Math.abs(change).toFixed(1)}%`,
    positive,
  };
}

function ValCell({ value, prev, sym, className }: { value: number; prev?: number; sym: string; className?: string }) {
  const h = fmtHuman(value, sym);
  const change = prev !== undefined ? pctChange(value, prev) : null;
  return (
    <td className={className}>
      <span className="sym-dim">{h.symbol}</span>{h.number}
      {change && (
        <span className={`change-badge ${change.positive ? 'change-up' : 'change-down'}`}>
          {change.arrow}{change.pct}
        </span>
      )}
    </td>
  );
}

export default function DetailTable({ snapshots, rate, symbol }: Props) {
  if (snapshots.length === 0) return null;

  const rows = [...snapshots].reverse();

  return (
    <div className="detail-table-container">
      <table className="detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Net Worth</th>
            <th>Fiat</th>
            <th>Digital</th>
            <th>Stock</th>
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const prev = i < rows.length - 1 ? rows[i + 1] : undefined;
            return (
              <tr key={s.date}>
                <td className="date-cell">{fmtDate(s.date)}</td>
                <ValCell value={s.totalUsd * rate} prev={prev ? prev.totalUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.fiatUsd * rate} prev={prev ? prev.fiatUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.digitalUsd * rate} prev={prev ? prev.digitalUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.stockUsd * rate} prev={prev ? prev.stockUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.debtUsd * rate} prev={prev ? prev.debtUsd * rate : undefined} sym={symbol} className="debt-cell" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
