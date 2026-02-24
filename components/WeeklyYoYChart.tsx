"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Point = { year: number; weekLabel: string; total: number };

type Props = {
  data: Point[];
};

const TEAL_PRIMARY = "#00897B";
const NAVY_SECONDARY = "#1A3358";
const GRAY_PRIOR_YEAR = "#A0AEC0";
const GRID_STROKE = "#EDF2F7";
const TOOLTIP_BG = "#0F2040";
const TOOLTIP_BORDER = "#00897B";

const COLORS = [TEAL_PRIMARY, NAVY_SECONDARY, GRAY_PRIOR_YEAR];

const WEEK_LABELS = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

export function WeeklyYoYChart({ data }: Props) {
  const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
  const chartData = WEEK_LABELS.map((weekLabel) => {
    const row: Record<string, string | number> = { weekLabel };
    years.forEach((y) => {
      const pt = data.find((d) => d.weekLabel === weekLabel && d.year === y);
      row[`y${y}`] = pt?.total ?? 0;
    });
    return row;
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const currentYear = new Date().getFullYear();

  return (
    <div className="card p-6">
      <h3 className="text-analytics-navy-primary font-bold text-lg">YoY weekly sales trend</h3>
      <p className="text-analytics-gray-text text-sm mt-0.5">Year-over-year comparison by week</p>
      <div className="h-80 mt-4">
        <ResponsiveContainer width="100%" height="100%" className="print-chart-full">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: "#4A5568", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#4A5568", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: TOOLTIP_BG,
                border: `1px solid ${TOOLTIP_BORDER}`,
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value: number) => [formatCurrency(value), "Sales"]}
            />
            <Legend
              formatter={(value) => value.replace("y", "")}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {years.map((y, i) => (
              <Line
                key={y}
                type="monotone"
                dataKey={`y${y}`}
                name={`y${y}`}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                strokeDasharray={y < currentYear ? "5 5" : undefined}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
