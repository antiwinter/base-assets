import { useState } from 'react';
import { usePortfolioData } from './hooks/usePortfolioData';
import SummaryCards from './components/SummaryCards';
import AllocationChart from './components/AllocationChart';
import TrendChart from './components/TrendChart';
import DetailTable from './components/DetailTable';

export type Currency = 'USD' | 'CNY';

export default function App() {
  const { snapshots, cnyRate, loading, error, reload } = usePortfolioData();
  const [currency, setCurrency] = useState<Currency>('CNY');
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;

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
              if (abs >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
              if (abs >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}K`;
              return `${symbol}${v.toFixed(2)}`;
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
      <SummaryCards snapshot={latest} rate={rate} symbol={symbol} />
      <div className="charts-row">
        <AllocationChart snapshot={latest} rate={rate} symbol={symbol} />
        <TrendChart snapshots={snapshots} rate={rate} symbol={symbol} />
      </div>
      <DetailTable snapshots={snapshots} rate={rate} symbol={symbol} />
    </div>
  );
}
