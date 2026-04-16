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
        <div className="header-left">
          <span className="header-label">Net Worth</span>
          <span className="header-value">
            {selected ? (() => {
              const v = selected.totalUsd * rate;
              const abs = Math.abs(v);
              let num: string;
              if (abs >= 1_000_000) num = `${(v / 1_000_000).toFixed(2)}m`;
              else if (abs >= 1_000) num = `${(v / 1_000).toFixed(1)}k`;
              else num = v.toFixed(2);
              const change = prevSelected ? ((selected.totalUsd - prevSelected.totalUsd) / Math.abs(prevSelected.totalUsd)) * 100 : null;
              return <>
                <span className="sym-dim">{symbol}</span>{num}
                {change !== null && (
                  <span className={`change-badge ${change >= 0 ? 'change-up' : 'change-down'}`}>
                    {change >= 0 ? '↑' : '↓'}{Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </>;
            })() : '--'}
          </span>
        </div>
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
      <TreemapChart snapshot={selected} prevSnapshot={prevSelected} rate={rate} symbol={symbol} />
      <h2 className="section-title">Worth Trend</h2>
      <TrendChart
        snapshots={snapshots}
        rate={rate}
        symbol={symbol}
        selectedIndex={resolvedIndex}
        onSelectIndex={setSelectedIndex}
      />
      <h2 className="section-title">Snapshot History</h2>
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
