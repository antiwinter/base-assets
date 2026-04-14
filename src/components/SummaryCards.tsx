import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot | undefined;
  rate: number;
  symbol: string;
}

function fmt(value: number, sym: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sym}${(value / 1_000).toFixed(1)}K`;
  return `${sym}${value.toFixed(2)}`;
}

export default function SummaryCards({ snapshot, rate, symbol }: Props) {
  if (!snapshot) return null;

  const cards = [
    { label: 'Fiat', value: snapshot.fiatUsd * rate, color: '#22c55e' },
    { label: 'Digital', value: snapshot.digitalUsd * rate, color: '#f59e0b' },
    { label: 'Stock', value: snapshot.stockUsd * rate, color: '#3b82f6' },
    { label: 'Debt', value: snapshot.debtUsd * rate, color: '#ef4444' },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
          <div className="card-label">{c.label}</div>
          <div className="card-value" style={{ color: c.color }}>
            {fmt(c.value, symbol)}
          </div>
        </div>
      ))}
    </div>
  );
}
