import type { Snapshot } from '../types';
import { fmtCurrency, getDisplaySymbol } from '../settingStore';

interface Props {
  snapshot: Snapshot | undefined;
  prevSnapshot: Snapshot | undefined;
  rate: number;
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

export default function SummaryCards({ snapshot, prevSnapshot, rate }: Props) {
  if (!snapshot) return null;

  const cards = [
    { label: 'Fiat', value: snapshot.fiatUsd * rate, prev: prevSnapshot ? prevSnapshot.fiatUsd * rate : undefined, color: '#82ca9d' },
    { label: 'Stock', value: snapshot.stockUsd * rate, prev: prevSnapshot ? prevSnapshot.stockUsd * rate : undefined, color: '#8884d8' },
    { label: 'Digital', value: snapshot.digitalUsd * rate, prev: prevSnapshot ? prevSnapshot.digitalUsd * rate : undefined, color: '#ffc658' },
    { label: 'Fixed', value: snapshot.fixedUsd * rate, prev: prevSnapshot ? prevSnapshot.fixedUsd * rate : undefined, color: '#000000' },
    { label: 'Debt', value: snapshot.debtUsd * rate, prev: prevSnapshot ? prevSnapshot.debtUsd * rate : undefined, color: '#c0392b' },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => {
        const change = c.prev !== undefined ? pctChange(c.value, c.prev) : null;
        return (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>
              <span className="sym-dim">{getDisplaySymbol()}</span>{fmtCurrency({ v: c.value }).slice(getDisplaySymbol().length)}
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
