import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList, ReferenceArea, Rectangle,
} from 'recharts';
import { fmtCurrency, fmtNum } from '../settingStore';
import type { CashFlowItem } from '../types';
import {
  buildDriversWithRates,
  splitTop3,
  INCOME_COLORS,
  EXPENSE_COLORS,
  findTopmostPositiveKey,
  findBottommostNegativeKey,
} from './cashflowChartShared';
import {
  CashflowTooltipCard,
  buildCashflowCategoryTooltipRows,
} from './cashflowTooltipShared';
import { getAge } from '../types';

interface Props {
  items: CashFlowItem[];
  rate: number;
  prices: Map<string, number>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

interface YearData {
  year: number;
  /** Calendar age for the year (year − birth year). */
  age: number;
  income: number;
  expense: number;
  net: number;
  selected: boolean;
  incomeTop1: number;
  incomeTop2: number;
  incomeTop3: number;
  incomeOthers: number;
  incomeTop1Name?: string;
  incomeTop2Name?: string;
  incomeTop3Name?: string;
  expenseTop1: number;
  expenseTop2: number;
  expenseTop3: number;
  expenseOthers: number;
  expenseTop1Name?: string;
  expenseTop2Name?: string;
  expenseTop3Name?: string;
  /** Per line-item totals for the year (tooltip). */
  details: { name: string; value: number }[];
}

/** Zoom limits: how many calendar years are shown at once. */
const MIN_WINDOW_YEARS = 15;
const MAX_WINDOW_YEARS = 25;
/** Full timeline available for scrolling (inclusive end year). */
const RANGE_MIN = 2015;
const RANGE_MAX = 2099;

function clampWindowStart(start: number, years: number): number {
  const maxStart = RANGE_MAX - years + 1;
  return Math.min(Math.max(RANGE_MIN, start), maxStart);
}
const INCOME_RENDER_ORDER = ['incomeTop3', 'incomeTop2', 'incomeTop1', 'incomeOthers'] as const;
const EXPENSE_RENDER_ORDER = ['expenseTop3', 'expenseTop2', 'expenseTop1', 'expenseOthers'] as const;

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  textDecoration: 'none',
  cursor: 'pointer',
  outline: 'none',
  boxShadow: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const linkDisabledStyle: React.CSSProperties = {
  ...linkStyle,
  color: '#cbd5e1',
  cursor: 'default',
};

export default function YearlyCashFlowChart({ items, rate, prices, selectedYear, onSelectYear }: Props) {
  const [windowYears, setWindowYears] = useState(MIN_WINDOW_YEARS);
  const [windowStart, setWindowStart] = useState(() =>
    clampWindowStart(selectedYear, MIN_WINDOW_YEARS),
  );
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWindowStart((s) => clampWindowStart(s, windowYears));
  }, [windowYears]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dominant =
        Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (dominant === 0) return;

      if (!e.shiftKey) {
        // Zoom: change window length (15–25 years). Scroll “out” → more years.
        e.preventDefault();
        const zoomOut = dominant > 0;
        setWindowYears((prev) => {
          const next = zoomOut
            ? Math.min(MAX_WINDOW_YEARS, prev + 1)
            : Math.max(MIN_WINDOW_YEARS, prev - 1);
          return next;
        });
        return;
      }

      e.preventDefault();
      const step = dominant > 0 ? 1 : -1;
      setWindowStart((w) => clampWindowStart(w + step, windowYears));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [windowYears]);

  const windowEnd = windowStart + windowYears - 1;

  const data = useMemo(() => {
    const drivers = buildDriversWithRates(items, rate, prices);

    const result: YearData[] = [];
    for (let yi = 0; yi < windowYears; yi++) {
      const y = windowStart + yi;
      let income = 0;
      let expense = 0;
      const incomeByDriver = new Map<string, number>();
      const expenseByDriver = new Map<string, number>();

      for (let m = 1; m <= 12; m++) {
        for (const driver of drivers) {
          const breakdown = driver.getMonthBreakdown(y, m);
          for (const [name, raw] of Object.entries(breakdown)) {
            const value = Math.round(raw * driver.convRate);
            if (value > 0) {
              income += value;
              incomeByDriver.set(name, (incomeByDriver.get(name) ?? 0) + value);
            } else if (value < 0) {
              expense += value;
              expenseByDriver.set(name, (expenseByDriver.get(name) ?? 0) + value);
            }
          }
        }
      }

      const incomeItems = Array.from(incomeByDriver.entries()).map(([name, value]) => ({ name, value }));
      const expenseItems = Array.from(expenseByDriver.entries()).map(([name, value]) => ({ name, value }));
      const topIncome = splitTop3(incomeItems, false);
      const topExpense = splitTop3(expenseItems, true);

      const details: { name: string; value: number }[] = [
        ...[...incomeByDriver.entries()].map(([name, value]) => ({ name, value })),
        ...[...expenseByDriver.entries()].map(([name, value]) => ({ name, value })),
      ].filter((d) => d.value !== 0);

      result.push({
        year: y,
        age: getAge(y),
        income,
        expense,
        net: income + expense,
        selected: y === selectedYear,
        details,
        incomeTop1: topIncome.top1,
        incomeTop2: topIncome.top2,
        incomeTop3: topIncome.top3,
        incomeOthers: topIncome.others,
        incomeTop1Name: topIncome.top1Name,
        incomeTop2Name: topIncome.top2Name,
        incomeTop3Name: topIncome.top3Name,
        expenseTop1: topExpense.top1,
        expenseTop2: topExpense.top2,
        expenseTop3: topExpense.top3,
        expenseOthers: topExpense.others,
        expenseTop1Name: topExpense.top1Name,
        expenseTop2Name: topExpense.top2Name,
        expenseTop3Name: topExpense.top3Name,
      });
    }
    return result;
  }, [items, rate, prices, windowStart, windowYears, selectedYear]);

  if (items.length === 0) return null;

  const yMax = Math.max(...data.map(d => d.income)) * 1.2;
  const yMin = Math.min(...data.map(d => d.expense)) * 1.2;
  const ySpan = yMax - yMin;
  /** Thin strip at the bottom of the plot (value coords), like a year underline on the category axis. */
  const selectionBarY2 = yMin + ySpan * 0.022;

  const handleClick = (state: any) => {
    if (state?.activeLabel != null) {
      onSelectYear(Number(state.activeLabel));
    }
  };

  const calendarYear = new Date().getFullYear();
  const snappedToCalendarYear =
    selectedYear === calendarYear &&
    windowStart === clampWindowStart(calendarYear, windowYears);

  return (
    <div className="chart-container">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 15,
        }}
      >
        <h3 style={{ margin: 0 }}>Yearly Cashflow {' '}
        <span style={{ color: '#94a3b8', fontWeight: 300 }}>{windowStart} ~ {windowEnd}</span>
        </h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
          <a
            href="#"
            style={snappedToCalendarYear ? linkDisabledStyle : linkStyle}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              if (snappedToCalendarYear) return;
              onSelectYear(calendarYear);
              setWindowStart(clampWindowStart(calendarYear, windowYears));
            }}
          >
            {calendarYear}
          </a>
        </div>
      </div>
      <div ref={chartWrapRef}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          barGap={0}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => String(v).slice(2)}
            padding={{ left: 12, right: 4 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => fmtCurrency({ v })}
            domain={[yMin, yMax]}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: '#f36661', fillOpacity: 0.1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as YearData;
              const rows = buildCashflowCategoryTooltipRows({ details: d.details });
              return <CashflowTooltipCard title={String(d.year)} rows={rows} />;
            }}
          />
          <Bar
            dataKey="incomeTop3"
            name="Income Top3"
            stackId="income"
            fill={INCOME_COLORS[0]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop3' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeTop2"
            name="Income Top2"
            stackId="income"
            fill={INCOME_COLORS[1]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop2' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeTop1"
            name="Income Top1"
            stackId="income"
            fill={INCOME_COLORS[2]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeTop1' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="incomeOthers"
            name="Income Others"
            stackId="income"
            fill={INCOME_COLORS[3]}
            shape={(props: any) => {
              const topKey = findTopmostPositiveKey(props.payload as Record<string, number>, INCOME_RENDER_ORDER);
              return <Rectangle {...props} radius={topKey === 'incomeOthers' ? [3, 3, 0, 0] : 0} />;
            }}
          >
            <LabelList
              dataKey="net"
              position="top"
              content={(labelProps: any) => {
                const { x, y, width, value, index } = labelProps;
                const v = value as number;
                // Recharts strips `payload` in filterProps; resolve row by bar index.
                const row = typeof index === 'number' ? data[index] : undefined;
                const age =
                  row?.year != null ? getAge(row.year) : '';
                return (
                  <g>
                    <text
                      x={x + width / 2}
                      y={y - 18}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={500}
                      fill="#94a3b8"
                    >
                      {age}
                    </text>
                    <text
                      x={x + width / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={600}
                      fill={v >= 0 ? '#8dc77b' : '#ff6262'}
                    >
                      {v >= 0 ? '+' : ''}{fmtNum(v)}
                    </text>
                  </g>
                );
              }}
            />
          </Bar>
          <Bar
            dataKey="expenseTop3"
            name="Expense Top3"
            stackId="expense"
            fill={EXPENSE_COLORS[0]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop3' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseTop2"
            name="Expense Top2"
            stackId="expense"
            fill={EXPENSE_COLORS[1]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop2' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseTop1"
            name="Expense Top1"
            stackId="expense"
            fill={EXPENSE_COLORS[2]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseTop1' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <Bar
            dataKey="expenseOthers"
            name="Expense Others"
            stackId="expense"
            fill={EXPENSE_COLORS[3]}
            shape={(props: any) => {
              const bottomKey = findBottommostNegativeKey(props.payload as Record<string, number>, EXPENSE_RENDER_ORDER);
              return <Rectangle {...props} radius={bottomKey === 'expenseOthers' ? [3, 3, 0, 0] : 0} />;
            }}
          />
          <ReferenceArea
            x1={selectedYear}
            x2={selectedYear}
            y1={yMin}
            y2={selectionBarY2}
            fill="rgba(238, 100, 100, 0.72)"
            stroke="none"
            ifOverflow="visible"
            isFront
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
