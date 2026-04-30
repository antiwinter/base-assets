import { useState } from 'react';
import TreemapChart from '../components/TreemapChart';
import TrendChart from '../components/TrendChart';
import DetailTable from '../components/DetailTable';
import { useAddSnapshot } from '../hooks/useAddSnapshot';
import { useSettingStore } from '../settingStore';
import { CAT_COLORS } from '../types';
import type { AppPageContext } from '../App';

export default function SnapshotPage({ ctx }: { ctx: AppPageContext }) {
  const { snapshots, rate, reloadPortfolio } = ctx;
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { addSnapshot, adding, error: addError } = useAddSnapshot(reloadPortfolio);
  const showFixed = useSettingStore((s) => s.showFixed);
  const showDebt = useSettingStore((s) => s.showDebt);
  const setShowFixed = useSettingStore((s) => s.setShowFixed);
  const setShowDebt = useSettingStore((s) => s.setShowDebt);

  const resolvedIndex = selectedIndex < 0 || selectedIndex >= snapshots.length
    ? snapshots.length - 1
    : selectedIndex;
  const selected = snapshots.length > 0 ? snapshots[resolvedIndex] : undefined;
  const prevSelected = resolvedIndex > 0 ? snapshots[resolvedIndex - 1] : undefined;

  const effectiveTotal = (s: typeof selected) =>
    s ? (showFixed ? s.totalUsd : s.totalUsd - s.fixedUsd) : undefined;

  return (
    <>
      <div className="section-title-row">
        <h2 className="section-title">Portfolio</h2>
        <div className="section-title-row-right">
          {addError && <span className="section-title-error" title={addError}>⚠ {addError}</span>}
          <div className="section-title-chips" role="group" aria-label="Portfolio category visibility">
            <button
              type="button"
              className={`section-title-chip${showDebt ? ' section-title-chip--on' : ''}`}
              aria-pressed={showDebt}
              onClick={() => setShowDebt(!showDebt)}
              title={showDebt ? 'Click to hide debt on the portfolio chart' : 'Click to show debt on the portfolio chart'}
              style={
                showDebt
                  ? {
                      borderColor: CAT_COLORS.Debt,
                      color: CAT_COLORS.Debt,
                      background: 'rgba(255, 98, 98, 0.12)',
                    }
                  : undefined
              }
            >
              debt
            </button>
            <button
              type="button"
              className={`section-title-chip${showFixed ? ' section-title-chip--on' : ''}`}
              aria-pressed={showFixed}
              onClick={() => setShowFixed(!showFixed)}
              title={
                showFixed
                  ? 'Click to hide fixed from portfolio, trend, and snapshots table'
                  : 'Click to show fixed in portfolio, trend, and snapshots table'
              }
              style={
                showFixed
                  ? {
                      borderColor: CAT_COLORS.Fixed,
                      background: CAT_COLORS.Fixed,
                      color: '#fff',
                    }
                  : undefined
              }
            >
              fixed
            </button>
          </div>
          <button
            type="button"
            className="section-title-action"
            onClick={addSnapshot}
            disabled={adding}
          >
            {adding ? 'Adding…' : '+ Add snapshot'}
          </button>
        </div>
      </div>
      <TreemapChart
        snapshot={selected}
        prevSnapshot={prevSelected}
        rate={rate}
        date={selected?.date}
        netWorth={(() => { const v = effectiveTotal(selected); return v !== undefined ? v * rate : undefined; })()}
        prevNetWorth={(() => { const v = effectiveTotal(prevSelected); return v !== undefined ? v * rate : undefined; })()}
      />
      <h2 className="section-title">Trend</h2>
      <TrendChart
        snapshots={snapshots}
        rate={rate}
        selectedIndex={resolvedIndex}
        onSelectIndex={setSelectedIndex}
      />
      <h2 className="section-title">Snapshots</h2>
      <DetailTable
        snapshots={snapshots}
        rate={rate}
        selectedIndex={resolvedIndex}
        onSelectIndex={setSelectedIndex}
      />
    </>
  );
}
