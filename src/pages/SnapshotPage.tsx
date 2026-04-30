import { useState } from 'react';
import TreemapChart from '../components/TreemapChart';
import TrendChart from '../components/TrendChart';
import DetailTable from '../components/DetailTable';
import { useAddSnapshot } from '../hooks/useAddSnapshot';
import { fmtNum, getDisplaySymbol, useSettingStore } from '../settingStore';
import { CAT_COLORS } from '../types';
import type { AppPageContext } from '../App';

function fmtPortfolioDate(ts: number): string {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

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

  const portfolioNetWorth =
    selected !== undefined
      ? (() => {
          const v = effectiveTotal(selected);
          return v !== undefined ? v * rate : undefined;
        })()
      : undefined;
  const portfolioPrevNetWorth =
    prevSelected !== undefined
      ? (() => {
          const v = effectiveTotal(prevSelected);
          return v !== undefined ? v * rate : undefined;
        })()
      : undefined;
  const portfolioChangeStr =
    portfolioNetWorth !== undefined &&
    portfolioPrevNetWorth !== undefined &&
    portfolioPrevNetWorth !== 0
      ? (() => {
          const pct =
            ((portfolioNetWorth - portfolioPrevNetWorth) /
              Math.abs(portfolioPrevNetWorth)) *
            100;
          const arrow = pct >= 0 ? '↑' : '↓';
          return `${arrow}${Math.abs(pct).toFixed(1)}%`;
        })()
      : null;

  return (
    <>
      <div className="section-title-row">
        <div className="section-title-portfolio-group">
          <h2 className="section-title">Portfolio</h2>
          {portfolioNetWorth !== undefined && (
            <>
              <span className="portfolio-heading-worth">
                <span className="sym-dim">{getDisplaySymbol()}</span>
                {fmtNum(portfolioNetWorth)}
              </span>
              {portfolioChangeStr && (
                <span
                  className={`portfolio-heading-change ${
                    portfolioChangeStr.startsWith('↑') ? 'change-up' : 'change-down'
                  }`}
                >
                  {portfolioChangeStr}
                </span>
              )}
              {selected?.date !== undefined && (
                <span className="portfolio-heading-date">
                  {fmtPortfolioDate(selected.date)}
                </span>
              )}
            </>
          )}
        </div>
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
      <TreemapChart snapshot={selected} prevSnapshot={prevSelected} rate={rate} />
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
