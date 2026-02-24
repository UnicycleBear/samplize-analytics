"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { StoreMetrics } from "@/lib/analytics";
import { MetricCard } from "@/components/MetricCard";
import { DailySalesChart } from "@/components/DailySalesChart";
import { WeeklyYoYChart } from "@/components/WeeklyYoYChart";
import { TopProductsTable } from "@/components/TopProductsTable";

type FastResponse =
  | { metrics: StoreMetrics; cachedAt: string }
  | { loading: true };
type WeeklyResponse = { weeklySalesByYear: StoreMetrics["weeklySalesByYear"]; cachedAt: string };

function SkeletonCard() {
  return (
    <div className="card p-5 border-l-4 border-l-analytics-border-light animate-pulse">
      <div className="h-3 w-20 bg-analytics-skeleton rounded mb-3" />
      <div className="h-10 w-28 bg-analytics-skeleton rounded" />
      <div className="mt-2 h-5 w-24 bg-analytics-skeleton-highlight rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-12 bg-analytics-skeleton rounded-t-xl" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex border-b border-analytics-border-light px-5 py-3 gap-4">
          <div className="h-4 flex-1 bg-analytics-skeleton-highlight rounded" />
          <div className="h-4 w-20 bg-analytics-skeleton-highlight rounded" />
          <div className="h-4 w-16 bg-analytics-skeleton-highlight rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-5 w-48 bg-analytics-skeleton rounded mb-1" />
      <div className="h-4 w-32 bg-analytics-skeleton-highlight rounded mb-4" />
      <div className="h-80 rounded-lg bg-analytics-skeleton/50" />
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="card p-6 border border-analytics-negative/30 bg-analytics-negative/5">
      <p className="text-analytics-negative font-medium">Error</p>
      <p className="text-sm text-analytics-gray-text mt-1">{message}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-analytics-navy-primary font-bold text-lg border-b-2 border-analytics-teal-accent pb-1 inline-block">
        {title}
      </h2>
      <div className="h-px bg-analytics-border-light mt-1" />
    </div>
  );
}

function cacheAgeColor(ms: number): string {
  if (ms < 60 * 60 * 1000) return "text-analytics-teal-light";
  if (ms < 24 * 60 * 60 * 1000) return "text-amber-400";
  return "text-analytics-negative";
}

function cacheDotColor(ms: number): string {
  if (ms < 60 * 60 * 1000) return "bg-analytics-teal-accent";
  if (ms < 24 * 60 * 60 * 1000) return "bg-amber-400";
  return "bg-analytics-negative";
}

function formatAge(ms: number): string {
  if (ms < 60 * 1000) return "< 1 min";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr`;
  return `${Math.floor(hr / 24)} day(s)`;
}

export default function DashboardPage() {
  const [fastData, setFastData] = useState<FastResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyResponse | null>(null);
  const [fastError, setFastError] = useState<string | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [fastLoading, setFastLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [fastPolling, setFastPolling] = useState(false);

  const fastPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFast = useCallback(async () => {
    setFastError(null);
    try {
      const res = await fetch("/api/analytics/fast", { cache: "no-store" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || res.statusText);
      }
      const data: FastResponse = await res.json();
      if ("loading" in data && data.loading) {
        setFastData(null);
        setFastPolling(true);
        setFastLoading(false);
        return;
      }
      setFastData(data);
      setFastPolling(false);
      if (fastPollIntervalRef.current) {
        clearInterval(fastPollIntervalRef.current);
        fastPollIntervalRef.current = null;
      }
    } catch (e) {
      setFastError(e instanceof Error ? e.message : "Failed to load");
      setFastPolling(false);
    } finally {
      setFastLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fastPolling) return;
    fastPollIntervalRef.current = setInterval(loadFast, 2_000);
    return () => {
      if (fastPollIntervalRef.current) {
        clearInterval(fastPollIntervalRef.current);
        fastPollIntervalRef.current = null;
      }
    };
  }, [fastPolling, loadFast]);

  const loadWeekly = useCallback(async () => {
    setWeeklyError(null);
    try {
      const res = await fetch("/api/analytics/weekly", { cache: "no-store" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error || res.statusText);
      }
      const data: WeeklyResponse = await res.json();
      setWeeklyData(data);
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : "Failed to load weekly");
    } finally {
      setWeeklyLoading(false);
    }
  }, []);

  useEffect(() => {
    setFastLoading(true);
    setWeeklyLoading(true);
    loadFast();
    loadWeekly();
  }, [loadFast, loadWeekly]);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      await fetch("/api/refresh-cache", { method: "POST" });
      setFastLoading(true);
      setWeeklyLoading(true);
      setFastData(null);
      setWeeklyData(null);
      loadFast();
      loadWeekly();
    } finally {
      setRefreshLoading(false);
    }
  };

  const hasFastMetrics = fastData && "metrics" in fastData;
  const metrics: StoreMetrics | null = hasFastMetrics
    ? {
        ...fastData.metrics,
        weeklySalesByYear: weeklyData?.weeklySalesByYear ?? fastData.metrics.weeklySalesByYear,
      }
    : null;

  const ordersCachedAt = hasFastMetrics ? fastData.cachedAt : null;
  const weeklyCachedAt = weeklyData?.cachedAt ?? null;
  const lastUpdatedAt =
    ordersCachedAt && weeklyCachedAt
      ? new Date(ordersCachedAt) > new Date(weeklyCachedAt)
        ? ordersCachedAt
        : weeklyCachedAt
      : ordersCachedAt ?? weeklyCachedAt;
  const ordersAgeMs = ordersCachedAt ? Date.now() - new Date(ordersCachedAt).getTime() : null;
  const weeklyAgeMs = weeklyCachedAt ? Date.now() - new Date(weeklyCachedAt).getTime() : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full bg-analytics-navy-primary border-b-2 border-analytics-navy-700 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-analytics-teal-accent text-white font-bold text-lg">
              S
            </div>
            <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">
              Samplize Analytics
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastUpdatedAt && (
              <span className="text-sm text-gray-300">
                Last updated: {formatAge(Date.now() - new Date(lastUpdatedAt).getTime())} ago
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshLoading}
              className="px-4 py-2 rounded-lg bg-analytics-teal-accent hover:bg-analytics-teal-light disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2"
            >
              {refreshLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Refreshing…
                </>
              ) : (
                "Refresh Data"
              )}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg border-2 border-white text-white hover:bg-white/10 text-sm font-medium"
            >
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {fastError && !hasFastMetrics && !fastPolling && (
          <div className="card p-8 max-w-md border border-analytics-negative/30">
            <p className="text-analytics-negative font-medium">Error loading dashboard</p>
            <p className="mt-2 text-analytics-gray-text text-sm">{fastError}</p>
          </div>
        )}

        {fastPolling && !metrics && (
          <div className="card p-8 max-w-md flex flex-col items-center gap-4">
            <span className="inline-block w-10 h-10 border-4 border-analytics-teal-accent/30 border-t-analytics-teal-accent rounded-full animate-spin" />
            <p className="text-analytics-navy-primary font-medium">Loading dashboard data…</p>
            <p className="text-sm text-analytics-gray-text">Checking every 2 seconds.</p>
          </div>
        )}

        {metrics && (
          <div className="space-y-10 flex-1">
            <section>
              <SectionHeader title="Key metrics" />
              {fastLoading && !fastData ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : fastError && fastData ? (
                <SectionError message={fastError} />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <MetricCard title="AOV MTD" value={metrics.aovMtd} format="currency" />
                  <MetricCard title="AOV yesterday" value={metrics.aovYesterday} format="currency" />
                  <MetricCard
                    title="Units per order MTD"
                    value={metrics.unitsPerOrderMtd}
                    format="decimal"
                  />
                  <MetricCard title="New customers MTD" value={metrics.newCustomersMtd} />
                  <MetricCard
                    title="% Canada sales MTD"
                    value={metrics.canadaSalesPercent}
                    format="percent"
                  />
                  <MetricCard
                    title="Repeat customer rate MTD"
                    value={metrics.repeatCustomerRatePercent}
                    format="percent"
                  />
                  <MetricCard
                    title="Orders per day (MTD avg)"
                    value={metrics.ordersPerDayMtd.toFixed(1)}
                  />
                  <MetricCard title="Revenue MTD" value={metrics.revenueMtd} format="currency" />
                </div>
              )}
            </section>

            <section>
              <SectionHeader title="Top 10 products by revenue (MTD)" />
              {fastLoading && !fastData ? (
                <SkeletonTable />
              ) : (
                <TopProductsTable rows={metrics.top10Products} />
              )}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <SectionHeader title="30-day trailing daily sales" />
                {fastLoading && !fastData ? (
                  <SkeletonChart />
                ) : (
                  <DailySalesChart data={metrics.dailySales} />
                )}
              </div>
              <div>
                <SectionHeader title="YoY weekly sales trend" />
                {weeklyLoading && !weeklyData ? (
                  <SkeletonChart />
                ) : weeklyError && !weeklyData ? (
                  <SectionError message={weeklyError} />
                ) : (
                  <WeeklyYoYChart data={metrics.weeklySalesByYear} />
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="bg-analytics-navy-primary text-white text-sm py-3 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-4">
          <span>
            Order data:{" "}
            {ordersAgeMs != null ? (
              <span className={cacheAgeColor(ordersAgeMs)}>{formatAge(ordersAgeMs)} old</span>
            ) : (
              "—"
            )}
          </span>
          <span>
            Weekly data:{" "}
            {weeklyAgeMs != null ? (
              <span className={cacheAgeColor(weeklyAgeMs)}>{formatAge(weeklyAgeMs)} old</span>
            ) : (
              "—"
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {ordersAgeMs != null && (
              <>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${cacheDotColor(ordersAgeMs)}`}
                  title={
                    ordersAgeMs < 3600000
                      ? "Fresh (< 1 hr)"
                      : ordersAgeMs < 86400000
                        ? "Aged (< 24 hr)"
                        : "Stale (> 24 hr)"
                  }
                />
                <span className="text-gray-300">Order</span>
              </>
            )}
            {weeklyAgeMs != null && (
              <>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${cacheDotColor(weeklyAgeMs)}`}
                  title={
                    weeklyAgeMs < 3600000
                      ? "Fresh (< 1 hr)"
                      : weeklyAgeMs < 86400000
                        ? "Aged (< 24 hr)"
                        : "Stale (> 24 hr)"
                  }
                />
                <span className="text-gray-300">Weekly</span>
              </>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
