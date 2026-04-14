import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot | undefined;
}

function fmt(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function SummaryCards({ snapshot }: Props) {
  if (!snapshot) return null;

  const cards = [
    { label: 'Net Worth', value: snapshot.totalUsd, color: '#6366f1' },
    { label: 'Fiat', value: snapshot.fiatUsd, color: '#22c55e' },
    { label: 'Digital', value: snapshot.digitalUsd, color: '#f59e0b' },
    { label: 'Debt', value: snapshot.debtUsd, color: '#ef4444' },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
          <div className="card-label">{c.label}</div>
          <div className="card-value" style={{ color: c.color }}>
            {fmt(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
