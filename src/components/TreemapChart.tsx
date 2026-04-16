import { ResponsiveTreeMap } from '@nivo/treemap';
import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot | undefined;
  prevSnapshot: Snapshot | undefined;
  rate: number;
  symbol: string;
}

const CAT_COLORS: Record<string, string> = {
  Fiat: '#22c55e',
  Stock: '#3b82f6',
  Digital: '#f59e0b',
  Debt: '#ef4444',
};

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

interface TreeNode {
  id: string;
  value?: number;
  children?: TreeNode[];
  color?: string;
  change?: string | null;
}

function buildTreeData(snapshot: Snapshot, prevSnapshot: Snapshot | undefined, rate: number): TreeNode {
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

  const children: TreeNode[] = [];
  for (const cat of ['Fiat', 'Stock', 'Digital', 'Debt']) {
    const platforms = catAccounts[cat];
    const total = catTotals[cat];
    if (Math.abs(total.cur) < 0.01 && platforms.size === 0) continue;

    const catChildren: TreeNode[] = [];
    for (const [platform, value] of platforms) {
      if (value < 0.01) continue;
      catChildren.push({ id: platform, value, color: CAT_COLORS[cat] });
    }
    catChildren.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const change = total.prev !== undefined ? changeLabel(Math.abs(total.cur), Math.abs(total.prev)) : null;

    children.push({
      id: cat,
      children: catChildren,
      color: CAT_COLORS[cat],
      change,
    });
  }

  return { id: 'root', children };
}

export default function TreemapChart({ snapshot, prevSnapshot, rate, symbol }: Props) {
  if (!snapshot) return null;

  const data = buildTreeData(snapshot, prevSnapshot, rate);
  if (!data.children || data.children.length === 0) return <div className="chart-empty">No assets</div>;

  return (
    <div className="chart-container treemap-container" style={{ height: 340 }}>
      <ResponsiveTreeMap
        data={data}
        identity="id"
        value="value"
        tile="squarify"
        leavesOnly={false}
        innerPadding={4}
        outerPadding={4}
        enableParentLabel={true}
        parentLabelPosition="left"
        parentLabelPadding={8}
        parentLabelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
        colors={(node) => {
          let n = node as { data?: { color?: string }; parent?: unknown };
          while (n) {
            if (n.data?.color) return n.data.color;
            n = n.parent as typeof n;
          }
          return '#94a3b8';
        }}
        borderWidth={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        nodeOpacity={0.25}
        label={(node) => {
          if (node.id === 'root') return '';
          const d = node.data as TreeNode;
          const isCategory = !!(d.children && d.children.length > 0);
          if (isCategory) {
            const val = fmtHuman(node.value);
            return d.change ? `${node.id}  ${symbol}${val}  ${d.change}` : `${node.id}  ${symbol}${val}`;
          }
          return `${node.id}  ${symbol}${fmtHuman(node.value)}`;
        }}
        labelSkipSize={30}
        labelTextColor={{ from: 'color', modifiers: [['darker', 2.5]] }}
        tooltip={({ node }) => {
          if (node.id === 'root') return null;
          return (
            <div style={{
              background: '#fff',
              padding: '6px 10px',
              borderRadius: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: 13,
            }}>
              <strong>{node.id}</strong>: {symbol}{fmtHuman(node.value)}
            </div>
          );
        }}
        animate={false}
      />
    </div>
  );
}
