import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot | undefined;
  prevSnapshot: Snapshot | undefined;
  rate: number;
  symbol: string;
}

function fmt(value: number, sym: string): { sym: string; num: string } {
  const abs = Math.abs(value);
  let num: string;
  if (abs >= 1_000_000) num = `${(value / 1_000_000).toFixed(2)}m`;
  else if (abs >= 1_000) num = `${(value / 1_000).toFixed(1)}k`;
  else num = value.toFixed(2);
  return { sym, num };
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

export default function SummaryCards({ snapshot, prevSnapshot, rate, symbol }: Props) {
  if (!snapshot) return null;

  const cards = [
    { label: 'Fiat', value: snapshot.fiatUsd * rate, prev: prevSnapshot ? prevSnapshot.fiatUsd * rate : undefined, color: '#22c55e' },
    { label: 'Stock', value: snapshot.stockUsd * rate, prev: prevSnapshot ? prevSnapshot.stockUsd * rate : undefined, color: '#3b82f6' },
    { label: 'Digital', value: snapshot.digitalUsd * rate, prev: prevSnapshot ? prevSnapshot.digitalUsd * rate : undefined, color: '#f59e0b' },
    { label: 'Debt', value: snapshot.debtUsd * rate, prev: prevSnapshot ? prevSnapshot.debtUsd * rate : undefined, color: '#ef4444' },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => {
        const f = fmt(c.value, symbol);
        const change = c.prev !== undefined ? pctChange(c.value, c.prev) : null;
        return (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>
              <span className="sym-dim">{f.sym}</span>{f.num}
              {change && (
                <span className={`change-badge ${change.positive ? 'change-up' : 'change-down'}`}>
                  {change.arrow}{change.pct}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
