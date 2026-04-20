import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList, ReferenceArea,
} from 'recharts';
import { fmtHuman } from '../types';
import type { CashFlowItem } from '../types';
import { createDriver } from '../cf-drivers/driver';

interface Props {
  items: CashFlowItem[];
  rate: number;
  symbol: string;
  prices: Map<string, number>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

interface YearData {
  year: number;
  income: number;
  expense: number;
  net: number;
  selected: boolean;
}

const YEAR_COUNT = 20;

export default function YearlyCashFlowChart({ items, rate, symbol, prices, selectedYear, onSelectYear }: Props) {
  const startYear = new Date().getFullYear();
  const cnyPriceUsd = prices.get('CNY') || 0.15;

  const data = useMemo(() => {
    const displayingCny = rate !== 1;
    const drivers = items.map((item) => {
      const unitPriceUsd = item.unit ? (prices.get(item.unit) ?? 1) : cnyPriceUsd;
      const convRate = displayingCny
        ? unitPriceUsd / cnyPriceUsd
        : unitPriceUsd;
      return { driver: createDriver(item), convRate };
    });

    const result: YearData[] = [];
    for (let yi = 0; yi < YEAR_COUNT; yi++) {
      const y = startYear + yi;
      let income = 0;
      let expense = 0;

      for (let m = 1; m <= 12; m++) {
        for (const { driver, convRate } of drivers) {
          const raw = driver.getMonthValue(y, m);
          const value = Math.round(raw * convRate);
          if (value > 0) income += value;
          else if (value < 0) expense += value;
        }
      }

      result.push({
        year: y,
        income,
        expense,
        net: income + expense,
        selected: y === selectedYear,
      });
    }
    return result;
  }, [items, rate, prices, cnyPriceUsd, startYear, selectedYear]);

  if (items.length === 0) return null;

  const handleClick = (state: any) => {
    if (state?.activeLabel != null) {
      onSelectYear(Number(state.activeLabel));
    }
  };

  return (
    <div className="chart-container">
      <h3>Yearly Cash Flow — {startYear}–{startYear + YEAR_COUNT - 1}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={0} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => String(v).slice(2)}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${symbol}${fmtHuman(v)}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip
            formatter={(v: number, name: string) => [`${symbol}${fmtHuman(v)}`, name]}
            labelFormatter={(label: string) => String(label)}
          />
          <ReferenceArea
            x1={selectedYear - 0.4}
            x2={selectedYear + 0.4}
            fill="#6366f1"
            fillOpacity={0.08}
            ifOverflow="visible"
          />
          <Bar dataKey="income" name="Income" fill="#8dc77b" radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="net"
              position="top"
              content={({ x, y, width, value }: any) => {
                const v = value as number;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill={v >= 0 ? '#8dc77b' : '#ff6262'}
                  >
                    {v >= 0 ? '+' : ''}{fmtHuman(v)}
                  </text>
                );
              }}
            />
          </Bar>
          <Bar dataKey="expense" name="Expense" fill="#ff6262" radius={[0, 0, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
