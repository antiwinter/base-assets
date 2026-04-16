import { useRef, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { CAT_COLORS } from '../types';
import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot | undefined;
  prevSnapshot: Snapshot | undefined;
  rate: number;
  symbol: string;
}

interface CatLabelInfo {
  x: number; y: number; width: number; height: number;
  name: string; value: number; change: string | null; color: string; sym: string;
}

function fmtHuman(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
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

function buildTreeData(snapshot: Snapshot, prevSnapshot: Snapshot | undefined, rate: number): CategoryNode[] {
  const catAccounts: Record<string, Map<string, number>> = {
    Fiat: new Map(),
    Stock: new Map(),
    Digital: new Map(),
    Debt: new Map(),
  };

  for (const a of snapshot.accounts) {
    const val = Math.abs(a.valueUsd * rate);
    const cat = a.category === 'fiat' ? 'Fiat'
      : a.category === 'stock' ? 'Stock'
      : a.category === 'digital' ? 'Digital'
      : 'Debt';
    const existing = catAccounts[cat].get(a.platform) ?? 0;
    catAccounts[cat].set(a.platform, existing + val);
  }

  const catTotals: Record<string, { cur: number; prev: number | undefined }> = {
    Fiat: { cur: snapshot.fiatUsd * rate, prev: prevSnapshot ? prevSnapshot.fiatUsd * rate : undefined },
    Stock: { cur: snapshot.stockUsd * rate, prev: prevSnapshot ? prevSnapshot.stockUsd * rate : undefined },
    Digital: { cur: snapshot.digitalUsd * rate, prev: prevSnapshot ? prevSnapshot.digitalUsd * rate : undefined },
    Debt: { cur: Math.abs(snapshot.debtUsd * rate), prev: prevSnapshot ? Math.abs(prevSnapshot.debtUsd * rate) : undefined },
  };

  const result: CategoryNode[] = [];
  for (const cat of ['Fiat', 'Stock', 'Digital', 'Debt']) {
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
          <text x={x + 8} y={y + 20} fontSize={14} fontWeight={500} fill="#fff">
            {name}
          </text>
        )}
        {showValue && (
          <text x={x + 8} y={y + 36} fontSize={12} fill="#fff">
            {sym}
            {fmtHuman(size)}
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
          {sym}
          {fmtHuman(size)}
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
          {catInfo.sym}{fmtHuman(catInfo.value)}
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
function CustomTooltip({ active, payload, sym }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const name = d.name ?? '';
  const cat = d.category ?? '';
  const color = d.color ?? '#94a3b8';
  const size = d.size ?? d.value ?? 0;
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
      {': '}{sym}{fmtHuman(size)}
    </div>
  );
}

export default function TreemapChart({ snapshot, prevSnapshot, rate, symbol }: Props) {
  const [zoomedCat, setZoomedCat] = useState<string | null>(null);
  const catLabelsRef = useRef<Map<string, CatLabelInfo>>(new Map());

  if (!snapshot) return null;

  const data = buildTreeData(snapshot, prevSnapshot, rate);
  if (data.length === 0) return <div className="chart-empty">No assets</div>;

  // When zoomed, show only that category's children as top-level data
  const zoomed = zoomedCat !== null;
  const catNode = zoomed ? data.find((d) => d.name === zoomedCat) : null;
  const displayData = catNode
    ? catNode.children.map((c) => ({ ...c, color: catNode.color }))
    : data;

  // Clear label positions before each render
  catLabelsRef.current.clear();

  const handleCategoryClick = (catName: string) => {
    if (!zoomed) setZoomedCat(catName);
  };

  return (
    <div className="chart-container treemap-container">
      {zoomed && (
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); setZoomedCat(null); }}
          style={{
            display: 'inline-block',
            marginBottom: 6,
            fontSize: 13,
            color: '#64748b',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          ← back
        </a>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <Treemap
          data={displayData}
          dataKey="size"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={<CustomContent sym={symbol} zoomed={zoomed} onCategoryClick={handleCategoryClick} catLabelsRef={catLabelsRef} />}
        >
          <Tooltip content={<CustomTooltip sym={symbol} />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
