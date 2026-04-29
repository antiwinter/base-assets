import { useEffect } from 'react';
import {
  CashflowTooltipCard,
  buildCashflowCategoryTooltipRows,
} from './cashflowTooltipShared';

interface Props {
  open: boolean;
  onClose: () => void;
  year: number;
  monthLabel: string;
  details: { name: string; value: number }[];
  cumulative: number;
}

/**
 * Right-side panel with full per-line cashflow breakdown (lvl1 + line items).
 */
export default function MonthDetailDrawer({
  open,
  onClose,
  year,
  monthLabel,
  details,
  cumulative,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rows = buildCashflowCategoryTooltipRows({
    details,
    cumulative,
    includeLineItems: true,
  });

  return (
    <>
      <div
        role="presentation"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.38)',
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(440px, 94vw)',
          background: '#fff',
          zIndex: 1001,
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'monthDrawerIn 0.22s ease-out',
        }}
      >
        <style>{`
          @keyframes monthDrawerIn {
            from { transform: translateX(100%); opacity: 0.96; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#111827' }}>
            {monthLabel} {year}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: 6,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ overflow: 'auto', padding: 16, flex: 1 }}>
          <CashflowTooltipCard title="Breakdown" rows={rows} embedded />
        </div>
      </aside>
    </>
  );
}
