import { parseSuffixApyPercent } from '../cf-drivers/depositInterest';
import { CAT_COLORS } from '../types';
import type { Snapshot, SnapshotAccount } from '../types';

const CATEGORY_LABEL: Record<string, string> = {
  fiat: 'Fiat',
  stock: 'Stock',
  digital: 'Digital',
  fixed: 'Fixed',
  debt: 'Debt',
};

/** Display currency size (same as treemap level-1). */
function accountKey(a: SnapshotAccount): string {
  return `${a.platform.trim()}\t${a.account.trim()}\t${a.unit.trim()}`;
}

/** APR % for heat: explicit CFI field first, else suffix on account name. */
export function effectiveApyPercent(a: SnapshotAccount): number {
  if (typeof a.aprPercent === 'number' && Number.isFinite(a.aprPercent)) {
    return a.aprPercent;
  }
  return parseSuffixApyPercent(a.account) ?? 0;
}

export function accountLeafDisplayName(a: Pick<SnapshotAccount, 'platform' | 'account' | 'unit'>): string {
  const p = a.platform.trim();
  const ac = a.account.trim();
  const u = a.unit.trim();
  return `${p}${ac ? `/${ac}` : ''} (${u})`;
}

/** Digital L2: unit-specific bases from `CAT_COLORS` (muted at 0% APY); others use `Digital`. */
export function digitalBaseColorHex(unit: string): string {
  const u = unit.trim().toUpperCase();
  if (u === '$BTC') return CAT_COLORS.$BTC;
  if (u === '$ETH') return CAT_COLORS.$ETH;
  if (u === '$USDT') return CAT_COLORS.$USDT;
  return CAT_COLORS.Digital;
}

function baseColorForCategory(cat: string, unit: string): string {
  if (cat === 'Digital') return digitalBaseColorHex(unit);
  return CAT_COLORS[cat] ?? '#94a3b8';
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Heat from APY: 0% → exact category (or digital unit) base color; maxApy% → strongest tint.
 * Scale is [0, maxApy] so zero-interest assets stay on the base swatch (unlike min–max normalization).
 */
export function heatAdjustColor(baseHex: string, apy: number, maxApy: number): string {
  const normalizedBase =
    baseHex.replace(/\s/g, '').toLowerCase() === '#000000' ? '#374151' : baseHex;
  if (apy <= 0 || maxApy <= 0) {
    return normalizedBase;
  }
  const t = clamp01(apy / maxApy);
  const { r, g, b } = hexToRgb(normalizedBase);
  let { h, s, l } = rgbToHsl(r, g, b);
  // Higher t → more saturated, slightly darker (same hue).
  s = clamp01(s + t * (0.92 - s) * 0.55);
  l = Math.max(0.18, l - t * (l - 0.28) * 0.85);
  const out = hslToRgb(h, s, l);
  return rgbToHex(out.r, out.g, out.b);
}

/** WCAG-style relative luminance for label pick. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export interface TreemapZoomLeaf {
  name: string;
  size: number;
  color: string;
  category: string;
  change: null;
  labelFill: string;
  /** Effective APR % used for heat + tooltip */
  apyHeat: number;
}

export function buildZoomedAccountLeaves(
  snapshot: Snapshot,
  zoomedCategory: string,
  rate: number,
  showFixed: boolean,
  showDebt: boolean,
): TreemapZoomLeaf[] {
  interface Bucket {
    size: number;
    weightUsd: number;
    apyWeighted: number;
    platform: string;
    account: string;
    unit: string;
  }
  const buckets = new Map<string, Bucket>();

  for (const a of snapshot.accounts) {
    if (!showFixed && a.category === 'fixed') continue;
    if (!showDebt && a.category === 'debt') continue;
    const cat = CATEGORY_LABEL[a.category] ?? 'Fiat';
    if (cat !== zoomedCategory) continue;
    const val = Math.abs(a.valueUsd * rate);
    if (val < 0.01) continue;
    const key = accountKey(a);
    const w = Math.abs(a.valueUsd);
    const apy = effectiveApyPercent(a);
    const cur = buckets.get(key);
    if (!cur) {
      buckets.set(key, {
        size: val,
        weightUsd: w,
        apyWeighted: apy * w,
        platform: a.platform,
        account: a.account,
        unit: a.unit,
      });
    } else {
      cur.size += val;
      cur.weightUsd += w;
      cur.apyWeighted += apy * w;
    }
  }

  const rows: { bucket: Bucket; apy: number }[] = [];
  for (const b of buckets.values()) {
    const apy = b.weightUsd > 0 ? b.apyWeighted / b.weightUsd : 0;
    rows.push({ bucket: b, apy });
  }

  if (rows.length === 0) return [];

  const maxApy = Math.max(0, ...rows.map((r) => r.apy));

  const leaves: TreemapZoomLeaf[] = rows.map(({ bucket: b, apy }) => {
    const base = baseColorForCategory(zoomedCategory, b.unit);
    const color = heatAdjustColor(base, apy, maxApy);
    const lum = relativeLuminance(color);
    const labelFill = lum > 0.58 ? '#0f172a' : '#fff';
    return {
      name: accountLeafDisplayName(b),
      size: b.size,
      color,
      category: zoomedCategory,
      change: null,
      labelFill,
      apyHeat: apy,
    };
  });
  leaves.sort((a, b) => b.size - a.size);
  return leaves;
}
