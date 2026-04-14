import { usePortfolioData } from './hooks/usePortfolioData';
import SummaryCards from './components/SummaryCards';
import AllocationChart from './components/AllocationChart';
import TrendChart from './components/TrendChart';
import DetailTable from './components/DetailTable';

export default function App() {
  const { snapshots, loading, error, reload } = usePortfolioData();
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;

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
        <h2>Portfolio Dashboard</h2>
        <button className="reload-btn" onClick={reload}>↻ Refresh</button>
      </header>
      <SummaryCards snapshot={latest} />
      <div className="charts-row">
        <AllocationChart snapshot={latest} />
        <TrendChart snapshots={snapshots} />
      </div>
      <DetailTable snapshots={snapshots} />
    </div>
  );
}
