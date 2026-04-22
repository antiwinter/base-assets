import { useState } from 'react';
import { useSettingStore, type AppTab } from './settingStore';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useCashFlowData } from './hooks/useCashFlowData';
import TreemapChart from './components/TreemapChart';
import TrendChart from './components/TrendChart';
import DetailTable from './components/DetailTable';
import CashFlowChart from './components/CashFlowChart';
import YearlyCashFlowChart from './components/YearlyCashFlowChart';

const NAV_ITEMS: { key: AppTab; label: string }[] = [
  { key: 'snapshot', label: 'Snapshot' },
  { key: 'cashflow', label: 'Cashflow' },
];

export type Currency = 'USD' | 'CNY';

export default function App() {
  const { snapshots, cnyRate, loading, error, reload } = usePortfolioData();
  const { items: cfItems, prices: cfPrices, loading: cfLoading, error: cfError } = useCashFlowData();
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { displayCurrency, currentTab, currentYear, setDisplayCurrency, setCurrentTab, setCurrentYear } = useSettingStore();
  const currency = displayCurrency as Currency;
  const page = currentTab;
  const cfYear = currentYear;

  // Resolve selected index: -1 means latest
  const resolvedIndex = selectedIndex < 0 || selectedIndex >= snapshots.length
    ? snapshots.length - 1
    : selectedIndex;
  const selected = snapshots.length > 0 ? snapshots[resolvedIndex] : undefined;
  const prevSelected = resolvedIndex > 0 ? snapshots[resolvedIndex - 1] : undefined;
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;

  const rate = currency === 'CNY' ? cnyRate : 1;

  const isLoading = loading || cfLoading;
  const anyError = error || cfError;

  if (isLoading) {
    return <div className="loading">Loading portfolio data…</div>;
  }

  if (anyError) {
    return (
      <div className="error">
        <p>Error: {anyError}</p>
        <button onClick={reload}>Retry</button>
      </div>
    );
  }

  return (
    <div className="layout">
      <nav className="nav-panel">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${page === item.key ? 'active' : ''}`}
            onClick={() => setCurrentTab(item.key as AppTab)}
          >
            {item.label}
          </button>
        ))}
        <div className="nav-spacer" />
        <div className="currency-switch">
          {(['USD', 'CNY'] as Currency[]).map((c) => (
            <button
              key={c}
              className={`currency-btn ${currency === c ? 'active' : ''}`}
              onClick={() => setDisplayCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </nav>
      <div className="app">
        {page === 'snapshot' && (
          <>
            <h2 className="section-title">Portfolio</h2>
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
        )}
        {page === 'cashflow' && (
          <>
            <h2 className="section-title">Cashflow</h2>
            <CashFlowChart
              items={cfItems}
              rate={rate}
              prices={cfPrices}
              year={cfYear}
            />
            <YearlyCashFlowChart
              items={cfItems}
              rate={rate}
              prices={cfPrices}
              selectedYear={cfYear}
              onSelectYear={setCurrentYear}
            />
          </>
        )}
      </div>
    </div>
  );
}
