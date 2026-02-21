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

export function DailySalesChart({ data }: Props) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4">30-day trailing daily sales</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--ink-muted))", fontSize: 11 }}
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
              tick={{ fill: "hsl(var(--ink-muted))", fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-muted))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--ink))" }}
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
              stroke="hsl(162, 63%, 41%)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
