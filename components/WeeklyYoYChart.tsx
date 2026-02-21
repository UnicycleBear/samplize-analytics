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

const COLORS = ["#22c55e", "#3b82f6", "#a855f7"];

export function WeeklyYoYChart({ data }: Props) {
  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b);
  const weekLabels = [...new Set(data.map((d) => d.weekLabel))].sort(
    (a, b) => parseInt(a.replace("W", ""), 10) - parseInt(b.replace("W", ""), 10)
  );
  const chartData = weekLabels.map((weekLabel) => {
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

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4">YoY weekly sales trend</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: "hsl(var(--ink-muted))", fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--ink-muted))", fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-muted))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
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
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
