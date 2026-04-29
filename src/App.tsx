import { useCallback, useEffect, useRef } from 'react';
import { NavLink, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useSettingStore } from './settingStore';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useCashFlowData } from './hooks/useCashFlowData';
import { useBitableBaseAutoRefresh } from './hooks/useBitableBaseAutoRefresh';
import UpdatePricesButton from './components/UpdatePricesButton';
import SnapshotPage from './pages/SnapshotPage';
import CashflowPage from './pages/CashflowPage';
import type { Snapshot, CashFlowItem } from './types';

export type Currency = 'USD' | 'CNY';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Snapshot', end: true },
  { to: '/cashflow', label: 'Cashflow' },
];

export interface AppPageContext {
  snapshots: Snapshot[];
  cnyRate: number;
  reloadPortfolio: () => void;
  cfItems: CashFlowItem[];
  cfPrices: Map<string, number>;
  rate: number;
  currency: Currency;
}

function useRoutePersistence() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastPath = useSettingStore((s) => s.lastPath);
  const setLastPath = useSettingStore((s) => s.setLastPath);
  const restoredRef = useRef(false);

  // Restore saved path on initial mount (the Lark host always loads the iframe
  // without a hash, so HashRouter would otherwise reset to `/`).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (lastPath && lastPath !== location.pathname && location.pathname === '/') {
      navigate(lastPath, { replace: true });
    }
  }, [lastPath, location.pathname, navigate]);

  // Persist the current path on every change.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (location.pathname !== lastPath) setLastPath(location.pathname);
  }, [location.pathname, lastPath, setLastPath]);
}

export default function App() {
  useRoutePersistence();
  const { snapshots, cnyRate, loading, error, reload, reloadSilent: reloadSnapshotSilent } =
    usePortfolioData();
  const {
    items: cfItems,
    prices: cfPrices,
    loading: cfLoading,
    error: cfError,
    reload: reloadCashflow,
    reloadSilent: reloadCashflowSilent,
  } = useCashFlowData();

  useBitableBaseAutoRefresh({
    reloadSnapshot: reloadSnapshotSilent,
    reloadCashflow: reloadCashflowSilent,
  });

  const handlePriceUpdateSuccess = useCallback(() => {
    void reload();
    void reloadCashflow();
  }, [reload, reloadCashflow]);
  const { displayCurrency, setDisplayCurrency } = useSettingStore();
  const currency = displayCurrency as Currency;
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
        <button
          type="button"
          onClick={() => {
            void reload();
            void reloadCashflow();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const ctx: AppPageContext = {
    snapshots,
    cnyRate,
    reloadPortfolio: reload,
    cfItems,
    cfPrices,
    rate,
    currency,
  };

  return (
    <div className="layout">
      <nav className="nav-panel">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="nav-spacer" />
        <UpdatePricesButton onSuccess={handlePriceUpdateSuccess} />
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
      <main className="main-pane">
        <div className="app">
          <Routes>
            <Route path="/" element={<SnapshotPage ctx={ctx} />} />
            <Route path="/cashflow" element={<CashflowPage ctx={ctx} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
