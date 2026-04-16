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

function timesChange(cur: number, prev: number): { arrow: string; label: string; positive: boolean } | null {
  if (prev === 0) return null;
  const ratio = cur / prev;
  const positive = cur >= prev;
  if (Math.abs(ratio) >= 2) {
    return { arrow: positive ? '↑' : '↓', label: `${Math.abs(ratio).toFixed(0)}×`, positive };
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { arrow: positive ? '↑' : '↓', label: `${Math.abs(pct).toFixed(0)}%`, positive };
}

function fmtHumanPlain(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

function ValCell({ value, prev, sym, className }: { value: number; prev?: number; sym: string; className?: string }) {
  const h = fmtHuman(value, sym);
  const change = prev !== undefined ? timesChange(value, prev) : null;
  return (
    <td className={className}>
      <span className="sym-dim">{h.symbol}</span>{h.number}
      {change && (
        <span className={`change-badge ${change.positive ? 'change-up' : 'change-down'}`}>
          {change.arrow}{change.label}
        </span>
      )}
    </td>
  );
}

function DebtCell({ value, prev, sym }: { value: number; prev?: number; sym: string }) {
  const absVal = Math.abs(value);
  const absPrev = prev !== undefined ? Math.abs(prev) : undefined;
  const h = fmtHuman(absVal, sym);
  const change = absPrev !== undefined && absPrev !== 0
    ? (() => {
        const ratio = absVal / absPrev;
        const increased = absVal >= absPrev;
        let label: string;
        if (ratio >= 2 || (absPrev / absVal) >= 2) {
          label = `${(increased ? ratio : absPrev / absVal).toFixed(0)}×`;
        } else {
          const pct = ((absVal - absPrev) / absPrev) * 100;
          label = `${Math.abs(pct).toFixed(0)}%`;
        }
        return {
          arrow: increased ? '↑' : '↓',
          label,
          increased,
        };
      })()
    : null;
  return (
    <td className="debt-cell">
      <span className="sym-dim">{h.symbol}</span>{h.number}
      {change && (
        <span className={`change-badge ${change.increased ? 'change-down' : 'change-up'}`}>
          {change.arrow}{change.label}
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
            <th>Velocity <span class="velocity-unit">/d</span></th>
            <th>Fiat</th>
            <th>Digital</th>
            <th>Stock</th>
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const prev = i < rows.length - 1 ? rows[i + 1] : undefined;
            const velocity = prev
              ? ((s.totalUsd - prev.totalUsd) * rate) / ((s.date - prev.date) / 86_400_000)
              : undefined;
            return (
              <tr key={s.date}>
                <td className="date-cell">{fmtDate(s.date)}</td>
                <ValCell value={s.totalUsd * rate} prev={prev ? prev.totalUsd * rate : undefined} sym={symbol} />
                <td className={`velocity-cell ${velocity !== undefined ? (velocity >= 0 ? 'change-up' : 'change-down') : ''}`}>
                  {velocity !== undefined ? (
                    <><span className="sym-dim">{symbol}</span>{fmtHumanPlain(velocity)}</>
                  ) : '–'}
                </td>
                <ValCell value={s.fiatUsd * rate} prev={prev ? prev.fiatUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.digitalUsd * rate} prev={prev ? prev.digitalUsd * rate : undefined} sym={symbol} />
                <ValCell value={s.stockUsd * rate} prev={prev ? prev.stockUsd * rate : undefined} sym={symbol} />
                <DebtCell value={s.debtUsd * rate} prev={prev ? prev.debtUsd * rate : undefined} sym={symbol} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
