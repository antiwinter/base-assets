import { fmtHuman } from '../types';

export interface CashflowTooltipRow {
  label: string;
  value: number;
  bold?: boolean;
}

interface CashflowTooltipCardProps {
  title: string;
  symbol: string;
  rows: CashflowTooltipRow[];
}

export function CashflowTooltipCard({ title, symbol, rows }: CashflowTooltipCardProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.14)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#111827' }}>
        {title}
      </div>
      {rows.map((r, i) => {
        const isCumulative = r.label.trim() === 'Cumulative';
        const cumulativeColor = r.value >= 0 ? '#16a34a' : '#dc2626';
        const showDivider = r.bold && i > 0;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              lineHeight: '1.6',
              marginTop: showDivider ? 6 : 0,
              paddingTop: showDivider ? 6 : 0,
              borderTop: showDivider ? '1px solid #e5e7eb' : 'none',
            }}
          >
            <span style={{ color: isCumulative ? cumulativeColor : (r.bold ? '#111827' : '#6b7280'), fontWeight: r.bold ? 700 : 400 }}>
              {r.label}
            </span>
            <span style={{ color: isCumulative ? cumulativeColor : (r.bold ? '#111827' : '#4b5563'), fontWeight: r.bold ? 700 : 400 }}>
              {symbol}{fmtHuman(r.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
