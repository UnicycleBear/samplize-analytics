/**
 * Background bulk op poller. Runs every 30 minutes, fetches recent orders via bulk op
 * and MTD LY via REST, then writes to the in-memory cache.
 * Start by calling ensureBulkPollerStarted() (e.g. from the fast route when cache is empty).
 */

import { fetchRecentOrdersViaBulk } from "./bulkOperations";
import { getShopifyConfig, fetchMtdLyOrdersViaRest } from "./shopify";
import { setCachedRecentOrders } from "./ordersCache";

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const g = globalThis as typeof globalThis & {
  __bulkPollerStarted?: boolean;
  __bulkPollerIntervalId?: ReturnType<typeof setInterval>;
};

async function runBulkFetch(): Promise<void> {
  try {
    console.log("[bulkPoller] starting bulk fetch");
    const config = getShopifyConfig();
    const [recentOrders, mtdLyOrders] = await Promise.all([
      fetchRecentOrdersViaBulk(),
      config ? fetchMtdLyOrdersViaRest(config) : Promise.resolve([]),
    ]);
    console.log("[bulkPoller] recentOrders:", recentOrders.length, "mtdLy:", mtdLyOrders?.length ?? 0);
    setCachedRecentOrders(recentOrders, mtdLyOrders?.length ? mtdLyOrders : null); // (orders from bulk op, MTD LY from REST)
  } catch (err) {
    console.error("[bulkPoller] error:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Starts the background poller if not already started.
 * Uses globalThis so the guard survives hot reload.
 * Runs one fetch immediately (after 0ms) and then every 30 minutes.
 */
export function ensureBulkPollerStarted(): void {
  if (g.__bulkPollerStarted) return;
  g.__bulkPollerStarted = true;
  console.log("[bulkPoller] starting (interval 30 min)");
  setTimeout(() => runBulkFetch(), 0);
  g.__bulkPollerIntervalId = setInterval(runBulkFetch, POLL_INTERVAL_MS);
}

/**
 * Trigger one bulk fetch immediately (e.g. after user clicks Refresh and cache is cleared).
 */
export function triggerBulkFetchNow(): void {
  ensureBulkPollerStarted();
  runBulkFetch();
}
