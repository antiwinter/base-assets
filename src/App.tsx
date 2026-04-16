import { useState } from 'react';
import { usePortfolioData } from './hooks/usePortfolioData';
import TreemapChart from './components/TreemapChart';
import TrendChart from './components/TrendChart';
import DetailTable from './components/DetailTable';

export type Currency = 'USD' | 'CNY';

export default function App() {
  const { snapshots, cnyRate, loading, error, reload } = usePortfolioData();
  const [currency, setCurrency] = useState<Currency>('CNY');
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
            {latest ? (() => {
              const v = latest.totalUsd * rate;
              const abs = Math.abs(v);
              let num: string;
              if (abs >= 1_000_000) num = `${(v / 1_000_000).toFixed(2)}m`;
              else if (abs >= 1_000) num = `${(v / 1_000).toFixed(1)}k`;
              else num = v.toFixed(2);
              const change = prev ? ((latest.totalUsd - prev.totalUsd) / Math.abs(prev.totalUsd)) * 100 : null;
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
      <TreemapChart snapshot={latest} prevSnapshot={prev} rate={rate} symbol={symbol} />
      <h2 className="section-title">Worth Trend</h2>
      <TrendChart snapshots={snapshots} rate={rate} symbol={symbol} />
      <h2 className="section-title">Snapshot History</h2>
      <DetailTable snapshots={snapshots} rate={rate} symbol={symbol} />
    </div>
  );
}
