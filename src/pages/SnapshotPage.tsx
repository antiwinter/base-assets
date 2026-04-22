import { useState } from 'react';
import TreemapChart from '../components/TreemapChart';
import TrendChart from '../components/TrendChart';
import DetailTable from '../components/DetailTable';
import { useAddSnapshot } from '../hooks/useAddSnapshot';
import type { AppPageContext } from '../App';

export default function SnapshotPage({ ctx }: { ctx: AppPageContext }) {
  const { snapshots, rate, reloadPortfolio } = ctx;
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { addSnapshot, adding, error: addError } = useAddSnapshot(reloadPortfolio);

  const resolvedIndex = selectedIndex < 0 || selectedIndex >= snapshots.length
    ? snapshots.length - 1
    : selectedIndex;
  const selected = snapshots.length > 0 ? snapshots[resolvedIndex] : undefined;
  const prevSelected = resolvedIndex > 0 ? snapshots[resolvedIndex - 1] : undefined;

  return (
    <>
      <div className="section-title-row">
        <h2 className="section-title">Portfolio</h2>
        <div className="section-title-row-right">
          {addError && <span className="section-title-error" title={addError}>⚠ {addError}</span>}
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
        netWorth={selected ? selected.totalUsd * rate : undefined}
        prevNetWorth={prevSelected ? prevSelected.totalUsd * rate : undefined}
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
