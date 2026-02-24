import { getCachedWeekly, writeWeeklyCache } from "@/lib/weeklyCache";
import { fetchWeeklyOrdersViaRest } from "@/lib/shopify";
import { startOfWeek, format, getISOWeek, getISOWeekYear } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET() {
  const cached = await getCachedWeekly();
  if (cached) {
    return Response.json(cached);
  }

  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2; // 3 years of weekly data

    console.log("[weekly] fetching orders via REST from", startYear);
    const orders = await fetchWeeklyOrdersViaRest(startYear);
    console.log("[weekly] fetched", orders.length, "orders");

    const weekBuckets: Record<string, number> = {};
    for (const { createdAt, totalPrice } of orders) {
      const d = new Date(createdAt);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      weekBuckets[key] = (weekBuckets[key] ?? 0) + totalPrice;
    }

    const years = [currentYear - 2, currentYear - 1, currentYear];
    const byYearWeekNum: Record<number, Record<number, number>> = {};
    years.forEach((y) => { byYearWeekNum[y] = {}; });

    for (const [weekStart, revenue] of Object.entries(weekBuckets)) {
      const d = new Date(weekStart);
      const y = getISOWeekYear(d);
      const w = getISOWeek(d);
      if (!years.includes(y)) continue;
      byYearWeekNum[y][w] = (byYearWeekNum[y][w] || 0) + revenue;
    }

    const allWeekNums = new Set<number>();
    years.forEach((y) => {
      Object.keys(byYearWeekNum[y]).forEach((k) => allWeekNums.add(Number(k)));
    });
    const sortedWeekNums = Array.from(allWeekNums).sort((a, b) => a - b);

    const weeklySalesByYear: { year: number; weekLabel: string; total: number }[] = [];
    sortedWeekNums.forEach((weekNum) => {
      const weekLabel = `W${weekNum}`;
      years.forEach((year) => {
        weeklySalesByYear.push({
          year,
          weekLabel,
          total: byYearWeekNum[year][weekNum] || 0,
        });
      });
    });

    const payload = { weeklySalesByYear, cachedAt: new Date().toISOString() };
    await writeWeeklyCache(payload);
    return Response.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[weekly] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
