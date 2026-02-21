"use client";

import { useEffect, useState } from "react";
import type { StoreMetrics } from "@/lib/analytics";
import { MetricCard } from "@/components/MetricCard";
import { SalesChannelTable } from "@/components/SalesChannelTable";
import { DailySalesChart } from "@/components/DailySalesChart";
import { WeeklyYoYChart } from "@/components/WeeklyYoYChart";

type ApiResponse = {
  combined: StoreMetrics;
  samplize: StoreMetrics;
  samplizeRetail: StoreMetrics;
};

type StoreOption = "combined" | "samplize" | "samplizeRetail";

const STORE_OPTIONS: { value: StoreOption; label: string }[] = [
  { value: "combined", label: "Combined" },
  { value: "samplize", label: "Samplize" },
  { value: "samplizeRetail", label: "Samplize Retail" },
];

export default function DashboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreOption>("combined");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/analytics")
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error(b.error || res.statusText)));
        return res.json();
      })
      .then((d: ApiResponse) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics: StoreMetrics | null = data
    ? data[store]
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-muted">Loading analytics…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <p className="text-rose-400 font-medium">Error</p>
          <p className="mt-2 text-ink-muted text-sm">{error || "No data"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Samplize Analytics</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">Store:</span>
          <select
            value={store}
            onChange={(e) => setStore(e.target.value as StoreOption)}
            className="bg-surface-muted border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {STORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {metrics && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-ink-muted mb-4">
              {metrics.label} — Key metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <MetricCard
                title="Total sales MTD"
                value={metrics.totalSalesMtd.current}
                comparison={metrics.totalSalesMtd}
                comparisonLabel="vs same period LY"
                format="currency"
              />
              <MetricCard
                title="Total sales yesterday"
                value={metrics.totalSalesYesterday.current}
                comparison={metrics.totalSalesYesterday}
                comparisonLabel="vs same day last week"
                format="currency"
              />
              <MetricCard
                title="Orders MTD"
                value={metrics.ordersMtd.current}
                comparison={metrics.ordersMtd}
                comparisonLabel="vs same period LY"
              />
              <MetricCard
                title="Orders yesterday"
                value={metrics.ordersYesterday.current}
                comparison={metrics.ordersYesterday}
                comparisonLabel="vs same day last week"
              />
              <MetricCard
                title="AOV MTD"
                value={metrics.aovMtd}
                format="currency"
              />
              <MetricCard
                title="AOV yesterday"
                value={metrics.aovYesterday}
                format="currency"
              />
              <MetricCard
                title="Units per order MTD"
                value={metrics.unitsPerOrderMtd}
                format="decimal"
              />
              <MetricCard
                title="New customers MTD"
                value={metrics.newCustomersMtd}
              />
              <MetricCard
                title="% Canada sales MTD"
                value={metrics.canadaSalesPercent}
                format="percent"
              />
            </div>
          </section>

          <section>
            <SalesChannelTable rows={metrics.salesByChannel} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DailySalesChart data={metrics.dailySales} />
            <WeeklyYoYChart data={metrics.weeklySalesByYear} />
          </section>
        </div>
      )}
    </div>
  );
}
