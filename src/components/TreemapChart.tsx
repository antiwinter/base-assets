import { useRef, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { CAT_COLORS } from '../types';
import type { Snapshot } from '../types';
import { fmtCurrency, useSettingStore } from '../settingStore';
import { buildZoomedAccountLeaves } from './treemapHeatmap';
interface Props {
  snapshot: Snapshot | undefined;
  prevSnapshot: Snapshot | undefined;
  rate: number;
}

interface CatLabelInfo {
  x: number; y: number; width: number; height: number;
  name: string; value: number; change: string | null; color: string; sym: string;
}

function changeLabel(cur: number, prev: number): string | null {
  if (prev === 0) return null;
  const ratio = cur / prev;
  const positive = cur >= prev;
  const arrow = positive ? '↑' : '↓';
  if (Math.abs(ratio) >= 2) return `${arrow}${Math.abs(ratio).toFixed(0)}×`;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return `${arrow}${Math.abs(pct).toFixed(0)}%`;
}

interface PlatformNode {
  name: string;
  size: number;
  color: string;
  category: string;
  change: string | null;
}

interface CategoryNode {
  name: string;
  color: string;
  change: string | null;
  children: PlatformNode[];
}

const CAT_ORDER = ['Fiat', 'Stock', 'Digital', 'Debt', 'Fixed'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  fiat: 'Fiat',
  stock: 'Stock',
  digital: 'Digital',
  fixed: 'Fixed',
  debt: 'Debt',
};

function buildTreeData(
  snapshot: Snapshot,
  prevSnapshot: Snapshot | undefined,
  rate: number,
  showFixed: boolean,
  showDebt: boolean,
): CategoryNode[] {
  const catAccounts: Record<string, Map<string, number>> = {
    Fiat: new Map(),
    Stock: new Map(),
    Digital: new Map(),
    Fixed: new Map(),
    Debt: new Map(),
  };

  for (const a of snapshot.accounts) {
    if (!showFixed && a.category === 'fixed') continue;
    if (!showDebt && a.category === 'debt') continue;
    const val = Math.abs(a.valueUsd * rate);
    const cat = CATEGORY_LABEL[a.category] ?? 'Fiat';
    const existing = catAccounts[cat].get(a.platform) ?? 0;
    catAccounts[cat].set(a.platform, existing + val);
  }

  const catTotals: Record<string, { cur: number; prev: number | undefined }> = {
    Fiat: { cur: snapshot.fiatUsd * rate, prev: prevSnapshot ? prevSnapshot.fiatUsd * rate : undefined },
    Stock: { cur: snapshot.stockUsd * rate, prev: prevSnapshot ? prevSnapshot.stockUsd * rate : undefined },
    Digital: { cur: snapshot.digitalUsd * rate, prev: prevSnapshot ? prevSnapshot.digitalUsd * rate : undefined },
    Fixed: { cur: snapshot.fixedUsd * rate, prev: prevSnapshot ? prevSnapshot.fixedUsd * rate : undefined },
    Debt: { cur: Math.abs(snapshot.debtUsd * rate), prev: prevSnapshot ? Math.abs(prevSnapshot.debtUsd * rate) : undefined },
  };

  const result: CategoryNode[] = [];
  for (const cat of CAT_ORDER) {
    if (!showFixed && cat === 'Fixed') continue;
    if (!showDebt && cat === 'Debt') continue;
    const platforms = catAccounts[cat];
    const total = catTotals[cat];
    if (Math.abs(total.cur) < 0.01 && platforms.size === 0) continue;

    const change = total.prev !== undefined ? changeLabel(Math.abs(total.cur), Math.abs(total.prev)) : null;
    const color = CAT_COLORS[cat];

    const children: PlatformNode[] = [];
    for (const [platform, value] of platforms) {
      if (value < 0.01) continue;
      children.push({ name: platform, size: value, color, category: cat, change });
    }
    children.sort((a, b) => b.size - a.size);

    if (children.length > 0) {
      result.push({ name: cat, color, change, children });
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, depth, name, root, sym, zoomed, onCategoryClick, catLabelsRef } = props;
  if (!width || !height || width < 2 || height < 2) return null;

  const color = root?.color ?? props.color ?? '#94a3b8';

  if (zoomed) {
    if (depth !== 1) return null;
    const showName = width > 30 && height > 16;
    const showValue = width > 50 && height > 30;
    const size = props.value ?? 0;
    const labelFill =
      typeof props.labelFill === 'string'
        ? props.labelFill
        : typeof props?.payload?.labelFill === 'string'
          ? props.payload.labelFill
          : '#fff';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{ fill: color, stroke: '#fff', strokeWidth: 2 }}
        />
        {showName && (
          <text x={x + 8} y={y + 20} fontSize={14} fontWeight={500} fill={labelFill}>
            {name}
          </text>
        )}
        {showValue && (
          <text x={x + 8} y={y + 36} fontSize={12} fill={labelFill}>
            {fmtCurrency({ v: size })}
          </text>
        )}
      </g>
    );
  }

  if (depth === 1) {
    // Category level — render rect only, store position for depth-2 overlay
    if (catLabelsRef) {
      catLabelsRef.current.set(name, {
        x, y, width, height, name,
        value: props.value ?? 0,
        change: props.change ?? null,
        color,
        sym,
      });
    }

    return (
      <g style={{ cursor: 'pointer' }} onClick={() => onCategoryClick?.(name)}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{ fill: color, stroke: '#fff', strokeWidth: 3 }}
        />
      </g>
    );
  }

  // depth === 2: Platform level
  const category = props.category ?? root?.name ?? '';
  const catInfo = catLabelsRef?.current.get(category);
  const showName = width > 30 && height > 16;
  const showValue = width > 50 && height > 30;
  const size = props.size ?? props.value ?? 0;

  // Category label conditions (rendered here at depth 2 so it paints on top of depth-1 rects)
  const showCatName = catInfo && catInfo.width > 40 && catInfo.height > 20;
  const showCatValue = catInfo && catInfo.width > 60 && catInfo.height > 36;
  const showCatChange = catInfo && catInfo.change && catInfo.width > 60 && catInfo.height > 50;

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onCategoryClick?.(category)}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: 'transparent', stroke: '#fff', strokeWidth: 1 }}
      />
      {showName && (
        <text x={x + 8} y={y + 20} fontSize={14} fontWeight={500} fill="#fff" style={{ pointerEvents: 'none' }}>
          {name}
        </text>
      )}
      {showValue && (
        <text x={x + 8} y={y + 36} fontSize={12} fill="#fff" style={{ pointerEvents: 'none' }}>
          {fmtCurrency({ v: size })}
        </text>
      )}
      {/* Category label — rendered at every depth-2 node so the last sibling's copy is on top */}
      {showCatName && (
        <text
          x={catInfo.x + catInfo.width / 2}
          y={catInfo.y + catInfo.height / 2 - (showCatValue ? 6 : 4)}
          textAnchor="middle" fontSize={20} fontWeight={700} fill="#444"
          style={{ pointerEvents: 'none' }}
        >
          {catInfo.name}
        </text>
      )}
      {showCatValue && (
        <text
          x={catInfo.x + catInfo.width / 2}
          y={catInfo.y + catInfo.height / 2 + 14}
          textAnchor="middle" fontSize={16} fill="#444"
          style={{ pointerEvents: 'none' }}
        >
          {fmtCurrency({ v: catInfo.value })}
        </text>
      )}
      {showCatChange && (
        <text
          x={catInfo.x + catInfo.width / 2}
          y={catInfo.y + catInfo.height / 2 + 30}
          textAnchor="middle" fontSize={12} fill="#444"
          style={{ pointerEvents: 'none' }}
        >
          {catInfo.change}
        </text>
      )}
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, zoomed }: { active?: boolean; payload?: any[]; zoomed: boolean }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const name = d.name ?? '';
  const cat = d.category ?? '';
  const color = d.color ?? '#94a3b8';
  const size = d.size ?? d.value ?? 0;
  const apyHeat = d.apyHeat;
  return (
    <div style={{
      background: '#fff',
      padding: '6px 10px',
      borderRadius: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      fontSize: 13,
      border: `1px solid ${color}`,
    }}>
      <span style={{ color, fontWeight: 600 }}>{cat}</span>
      {' / '}
      <strong>{name}</strong>
      {': '}{fmtCurrency({ v: size })}
      {zoomed && typeof apyHeat === 'number' && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
          APR: {apyHeat.toFixed(2)}%
        </div>
      )}
    </div>
  );
}
export default function TreemapChart({ snapshot, prevSnapshot, rate }: Props) {
  const [zoomedCat, setZoomedCat] = useState<string | null>(null);
  const catLabelsRef = useRef<Map<string, CatLabelInfo>>(new Map());
  const showFixed = useSettingStore((s) => s.showFixed);
  const showDebt = useSettingStore((s) => s.showDebt);

  if (!snapshot) return null;

  const data = buildTreeData(snapshot, prevSnapshot, rate, showFixed, showDebt);
  if (data.length === 0) return <div className="chart-empty">No assets</div>;

  const zoomed = zoomedCat !== null;
  const catNode = zoomed ? data.find((d) => d.name === zoomedCat) : null;
  const zoomedLeaves =
    zoomed && zoomedCat
      ? buildZoomedAccountLeaves(snapshot, zoomedCat, rate, showFixed, showDebt)
      : null;
  const displayData = zoomedLeaves !== null ? zoomedLeaves : data;

  // Clear label positions before each render
  catLabelsRef.current.clear();

  const handleCategoryClick = (catName: string) => {
    if (!zoomed) setZoomedCat(catName);
  };

  const zoomedCategoryTotal =
    zoomedLeaves !== null
      ? zoomedLeaves.reduce((sum, l) => sum + l.size, 0)
      : undefined;

  return (
    <div className="chart-container treemap-container">
      {zoomed && (
        <div className="treemap-zoom-bar">
          {catNode != null && zoomedCategoryTotal !== undefined && (
            <div className="treemap-zoom-bar-meta">
              <span className="treemap-zoom-category-name">{catNode.name}</span>
              <span className="treemap-zoom-category-worth">
                {fmtCurrency({ v: zoomedCategoryTotal })}
              </span>
            </div>
          )}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setZoomedCat(null); }}
            className="treemap-zoom-back"
          >
            ← back
          </a>
        </div>
      )}
      {zoomedLeaves !== null && zoomedLeaves.length === 0 ? (
        <div className="chart-empty">No accounts in this category</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={displayData}
            dataKey="size"
            aspectRatio={4 / 3}
            isAnimationActive={false}
            content={<CustomContent zoomed={zoomed} onCategoryClick={handleCategoryClick} catLabelsRef={catLabelsRef} />}
          >
            <Tooltip content={<CustomTooltip zoomed={zoomed} />} />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  );
}
