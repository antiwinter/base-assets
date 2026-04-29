import { useCallback, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList, Rectangle,
} from 'recharts';
import { fmtCurrency, fmtNum } from '../settingStore';
import type { CashFlowItem, Snapshot } from '../types';
import {
  buildAllCashflowDriversWithRates,
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
import MonthDetailDrawer from './MonthDetailDrawer';

interface Props {
  items: CashFlowItem[];
  snapshots: Snapshot[];
  rate: number;   // currency conversion rate (1 for USD, cnyRate for CNY)
  prices: Map<string, number>; // symbol → USD price (e.g. CNY→0.15, USD→1)
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthData {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
  details: { name: string; value: number }[];
  incomeTop1: number;
  incomeTop2: number;
  incomeTop3: number;
  incomeOthers: number;
  expenseTop1: number;
  expenseTop2: number;
  expenseTop3: number;
  expenseOthers: number;
}

const INCOME_RENDER_ORDER = ['incomeTop3', 'incomeTop2', 'incomeTop1', 'incomeOthers'] as const;
const EXPENSE_RENDER_ORDER = ['expenseTop3', 'expenseTop2', 'expenseTop1', 'expenseOthers'] as const;

export default function CashFlowChart({ items, snapshots, rate, prices, year }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMonth, setDrawerMonth] = useState<MonthData | null>(null);

  const data = useMemo(() => {
    const drivers = buildAllCashflowDriversWithRates(items, snapshots, rate, prices);

    let cumulative = 0;
    const result: MonthData[] = [];

    for (let m = 1; m <= 12; m++) {
      let income = 0;
      let expense = 0;
      const details: { name: string; value: number }[] = [];
      const incomeItems: { name: string; value: number }[] = [];
      const expenseItems: { name: string; value: number }[] = [];

      for (const driver of drivers) {
        const breakdown = driver.getMonthBreakdown(year, m);
        for (const [name, raw] of Object.entries(breakdown)) {
          const value = Math.round(raw * driver.convRate);
          if (value > 0) {
            income += value;
            incomeItems.push({ name, value });
          } else if (value < 0) {
            expense += value;
            expenseItems.push({ name, value });
          }
          if (value !== 0) {
            details.push({ name, value });
          }
        }
      }

      const topIncome = splitTop3(incomeItems, false);
      const topExpense = splitTop3(expenseItems, true);

      cumulative += income + expense;
      result.push({
        month: MONTHS[m - 1],
        income,
        expense,
        net: income + expense,
        cumulative,
        details,
        incomeTop1: topIncome.top1,
        incomeTop2: topIncome.top2,
        incomeTop3: topIncome.top3,
        incomeOthers: topIncome.others,
        expenseTop1: topExpense.top1,
        expenseTop2: topExpense.top2,
        expenseTop3: topExpense.top3,
        expenseOthers: topExpense.others,
      });
    }
    return result;
  }, [items, snapshots, rate, prices, year]);

  const handleChartClick = useCallback(
    (state: { activeLabel?: unknown; activePayload?: { payload?: MonthData }[] } | null) => {
      let label: string | undefined;
      if (state?.activeLabel != null) {
        label = String(state.activeLabel);
      } else if (state?.activePayload?.[0]?.payload?.month) {
        label = state.activePayload[0].payload.month;
      }
      if (!label) return;
      const row = data.find((d) => d.month === label);
      if (!row) return;
      setDrawerMonth(row);
      setDrawerOpen(true);
    },
    [data],
  );

  if (items.length === 0 && snapshots.length === 0) {
    return <div className="chart-empty">No cashflow items</div>;
  }

  return (
    <div className="chart-container monthly-chart-container">
      <h3 style={{ margin: 0 }}>
        Monthly Cashflow — {year}{' '}
        <span style={{ color: '#94a3b8', fontWeight: 300 }}>(age of {getAge(year)})</span>
      </h3>
      <br/>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={data}
          barGap={0}
          onClick={handleChartClick}
          style={{ cursor: 'pointer' }}
        >
          <XAxis dataKey="month" tick={{ fontSize: 12 }} padding={{ left: 12, right: 4 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => fmtCurrency({ v })}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as MonthData | undefined;
              if (!d) return null;
              const rows = buildCashflowCategoryTooltipRows({
                details: d.details,
                cumulative: d.cumulative,
              });
              return <CashflowTooltipCard title={String(label)} rows={rows} />;
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
              formatter={(v: number) => `${v >= 0 ? '+' : ''}${fmtNum(v)}`}
              style={{ fontSize: 11, fontWeight: 600 }}
              content={({ x, y, width, value }: any) => {
                const v = value as number;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={v >= 0 ? '#8dc77b' : '#ff6262'}
                  >
                      {v >= 0 ? '+' : ''}{fmtNum(v)}
                  </text>
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
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Cumulative"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <MonthDetailDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerMonth(null);
        }}
        year={year}
        monthLabel={drawerMonth?.month ?? ''}
        details={drawerMonth?.details ?? []}
        cumulative={drawerMonth?.cumulative ?? 0}
      />
    </div>
  );
}
