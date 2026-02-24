/**
 * Weekly 53-week YoY cache: Vercel KV when KV_REST_API_URL is set,
 * otherwise in-memory fallback for local development.
 */

const CACHE_KEY = "weekly-revenue-cache";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const KV_TTL_SECONDS = 86400; // 24 hours

export type WeeklyCachePayload = {
  weeklySalesByYear: { year: number; weekLabel: string; total: number }[];
  cachedAt: string; // ISO
};

type StoredValue = {
  weeklyRevenue: { year: number; weekLabel: string; total: number }[];
  lastUpdated: string;
};

let memoryFallback: StoredValue | null = null;

function useKv(): boolean {
  return typeof process.env.KV_REST_API_URL === "string" && process.env.KV_REST_API_URL.length > 0;
}

async function getFromKv(): Promise<StoredValue | null> {
  if (!useKv()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.get<StoredValue>(CACHE_KEY);
    return raw ?? null;
  } catch {
    return null;
  }
}

async function setInKv(data: StoredValue): Promise<void> {
  if (!useKv()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(CACHE_KEY, data, { ex: KV_TTL_SECONDS });
  } catch {
    // ignore
  }
}

/**
 * Returns cached weekly data if it exists and is less than 24 hours old.
 */
export async function getCachedWeekly(): Promise<WeeklyCachePayload | null> {
  let stored: StoredValue | null = null;
  if (useKv()) {
    stored = await getFromKv();
  } else {
    stored = memoryFallback;
  }
  if (!stored?.weeklyRevenue?.length || !stored.lastUpdated) return null;
  const age = Date.now() - new Date(stored.lastUpdated).getTime();
  if (age >= MAX_AGE_MS) return null;
  return {
    weeklySalesByYear: stored.weeklyRevenue,
    cachedAt: stored.lastUpdated,
  };
}

/**
 * Writes weekly revenue data to cache with 24hr TTL.
 */
export async function setCachedWeeklyRevenue(
  weeklyRevenue: { year: number; weekLabel: string; total: number }[]
): Promise<void> {
  const data: StoredValue = {
    weeklyRevenue,
    lastUpdated: new Date().toISOString(),
  };
  if (useKv()) {
    await setInKv(data);
  } else {
    memoryFallback = data;
  }
}

export async function writeWeeklyCache(payload: WeeklyCachePayload): Promise<void> {
  await setCachedWeeklyRevenue(payload.weeklySalesByYear);
}

export async function refreshWeeklyCache(): Promise<WeeklyCachePayload> {
  const { fetchWeeklyRevenueViaBulk } = await import("./bulkOperations");
  const { getISOWeek, getISOWeekYear } = await import("date-fns");

  const weekly = await fetchWeeklyRevenueViaBulk();
  const years = [2024, 2025, 2026];
  const byYearWeekNum: Record<number, Record<number, number>> = {};
  years.forEach((y) => {
    byYearWeekNum[y] = {};
  });
  for (const { weekStart, revenue } of weekly) {
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

  const payload: WeeklyCachePayload = {
    weeklySalesByYear,
    cachedAt: new Date().toISOString(),
  };
  await setCachedWeeklyRevenue(weeklySalesByYear);
  return payload;
}

export async function getWeeklyCacheAge(): Promise<number | null> {
  const data = await getCachedWeekly();
  if (!data?.cachedAt) return null;
  return Date.now() - new Date(data.cachedAt).getTime();
}
