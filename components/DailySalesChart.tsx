"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { date: string; total: number };

type Props = {
  data: Point[];
};

const TEAL_PRIMARY = "#00897B";
const GRID_STROKE = "#EDF2F7";
const TOOLTIP_BG = "#0F2040";
const TOOLTIP_BORDER = "#00897B";

export function DailySalesChart({ data }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="card p-6">
      <h3 className="text-analytics-navy-primary font-bold text-lg">30-day trailing daily sales</h3>
      <p className="text-analytics-gray-text text-sm mt-0.5">Daily revenue</p>
      <div className="h-80 mt-4">
        <ResponsiveContainer width="100%" height="100%" className="print-chart-full">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#4A5568", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                try {
                  const d = new Date(v);
                  return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return v;
                }
              }}
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
              labelStyle={{ color: "#fff" }}
              formatter={(value: number) => [formatCurrency(value), "Sales"]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={TEAL_PRIMARY}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
