import type { Snapshot } from '../types';
import { fmtCurrency, fmtNum, getCurrencySymbol } from '../currencyStore';

interface Props {
  snapshots: Snapshot[];
  rate: number;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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

function ValCell({ value, prev, className }: { value: number; prev?: number; className?: string }) {
  const change = prev !== undefined ? timesChange(value, prev) : null;
  return (
    <td className={className}>
      <span className="sym-dim">{getCurrencySymbol()}</span>{fmtNum(value)}
      {change && (
        <span className={`change-badge ${change.positive ? 'change-up' : 'change-down'}`}>
          {change.arrow}{change.label}
        </span>
      )}
    </td>
  );
}

function DebtCell({ value, prev }: { value: number; prev?: number }) {
  const absVal = Math.abs(value);
  const absPrev = prev !== undefined ? Math.abs(prev) : undefined;
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
      <span className="sym-dim">{getCurrencySymbol()}</span>{fmtNum(absVal)}
      {change && (
        <span className={`change-badge ${change.increased ? 'change-down' : 'change-up'}`}>
          {change.arrow}{change.label}
        </span>
      )}
    </td>
  );
}

export default function DetailTable({ snapshots, rate, selectedIndex, onSelectIndex }: Props) {
  if (snapshots.length === 0) return null;

  const rows = [...snapshots].reverse();

  return (
    <div className="detail-table-container">
      <table className="detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Net Worth</th>
            <th>Velocity <span className="velocity-unit">/d</span></th>
            <th>Fiat</th>
            <th>Digital</th>
            <th>Stock</th>
            <th>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const origIndex = snapshots.length - 1 - i;
            const prev = i < rows.length - 1 ? rows[i + 1] : undefined;
            const isSelected = origIndex === selectedIndex;
            const velocity = prev
              ? ((s.totalUsd - prev.totalUsd) * rate) / ((s.date - prev.date) / 86_400_000)
              : undefined;
            return (
              <tr
                key={s.date}
                onClick={() => onSelectIndex(origIndex)}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? '#f1f5f9' : undefined,
                  fontWeight: isSelected ? 500 : undefined,
                }}
              >
                <td className="date-cell">{fmtDate(s.date)}</td>
                <ValCell value={s.totalUsd * rate} prev={prev ? prev.totalUsd * rate : undefined} />
                <td className={`velocity-cell ${velocity !== undefined ? (velocity >= 0 ? 'change-up' : 'change-down') : ''}`}>
                  {velocity !== undefined ? (
                    <><span className="sym-dim">{getCurrencySymbol()}</span>{fmtNum(velocity)}</>
                  ) : '–'}
                </td>
                <ValCell value={s.fiatUsd * rate} prev={prev ? prev.fiatUsd * rate : undefined} />
                <ValCell value={s.digitalUsd * rate} prev={prev ? prev.digitalUsd * rate : undefined} />
                <ValCell value={s.stockUsd * rate} prev={prev ? prev.stockUsd * rate : undefined} />
                <DebtCell value={s.debtUsd * rate} prev={prev ? prev.debtUsd * rate : undefined} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
