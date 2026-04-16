import { useState } from 'react';
import { usePortfolioData } from './hooks/usePortfolioData';
import TreemapChart from './components/TreemapChart';
import TrendChart from './components/TrendChart';
import DetailTable from './components/DetailTable';

export type Currency = 'USD' | 'CNY';

export default function App() {
  const { snapshots, cnyRate, loading, error, reload } = usePortfolioData();
  const [currency, setCurrency] = useState<Currency>('CNY');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Resolve selected index: -1 means latest
  const resolvedIndex = selectedIndex < 0 || selectedIndex >= snapshots.length
    ? snapshots.length - 1
    : selectedIndex;
  const selected = snapshots.length > 0 ? snapshots[resolvedIndex] : undefined;
  const prevSelected = resolvedIndex > 0 ? snapshots[resolvedIndex - 1] : undefined;
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;

  const rate = currency === 'CNY' ? cnyRate : 1;
  const symbol = currency === 'CNY' ? '¥' : '$';

  if (loading) {
    return <div className="loading">Loading portfolio data…</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="currency-switch">
          {(['USD', 'CNY'] as Currency[]).map((c) => (
            <button
              key={c}
              className={`currency-btn ${currency === c ? 'active' : ''}`}
              onClick={() => setCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </header>
      <h2 className="section-title">Portfolio</h2>
      <TreemapChart
        snapshot={selected}
        prevSnapshot={prevSelected}
        rate={rate}
        symbol={symbol}
        date={selected?.date}
        netWorth={selected ? selected.totalUsd * rate : undefined}
        prevNetWorth={prevSelected ? prevSelected.totalUsd * rate : undefined}
      />
      <h2 className="section-title">Trend</h2>
      <TrendChart
        snapshots={snapshots}
        rate={rate}
        symbol={symbol}
        selectedIndex={resolvedIndex}
        onSelectIndex={setSelectedIndex}
      />
      <h2 className="section-title">Snapshots</h2>
      <DetailTable
        snapshots={snapshots}
        rate={rate}
        symbol={symbol}
        selectedIndex={resolvedIndex}
        onSelectIndex={setSelectedIndex}
      />
    </div>
  );
}
