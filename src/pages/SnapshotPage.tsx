import { useState } from 'react';
import TreemapChart from '../components/TreemapChart';
import TrendChart from '../components/TrendChart';
import DetailTable from '../components/DetailTable';
import { useAddSnapshot } from '../hooks/useAddSnapshot';
import { useSettingStore } from '../settingStore';
import type { AppPageContext } from '../App';

export default function SnapshotPage({ ctx }: { ctx: AppPageContext }) {
  const { snapshots, rate, reloadPortfolio } = ctx;
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { addSnapshot, adding, error: addError } = useAddSnapshot(reloadPortfolio);
  const hideFixed = useSettingStore((s) => s.hideFixed);
  const setHideFixed = useSettingStore((s) => s.setHideFixed);

  const resolvedIndex = selectedIndex < 0 || selectedIndex >= snapshots.length
    ? snapshots.length - 1
    : selectedIndex;
  const selected = snapshots.length > 0 ? snapshots[resolvedIndex] : undefined;
  const prevSelected = resolvedIndex > 0 ? snapshots[resolvedIndex - 1] : undefined;

  const effectiveTotal = (s: typeof selected) =>
    s ? (hideFixed ? s.totalUsd - s.fixedUsd : s.totalUsd) : undefined;

  return (
    <>
      <div className="section-title-row">
        <h2 className="section-title">Portfolio</h2>
        <div className="section-title-row-right">
          {addError && <span className="section-title-error" title={addError}>⚠ {addError}</span>}
          <button
            type="button"
            className={`section-title-toggle ${hideFixed ? 'on' : ''}`}
            onClick={() => setHideFixed(!hideFixed)}
            title={hideFixed ? 'Showing only liquid assets — click to include fixed' : 'Click to hide fixed assets from charts'}
          >
            <span className="toggle-knob" />
            <span className="toggle-label">Hide fixed</span>
          </button>
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
