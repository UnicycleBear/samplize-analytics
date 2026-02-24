/**
 * In-memory cache for short-range order data (fast endpoint).
 * TTL: 30 minutes.
 */

import type { RecentOrder } from "./bulkOperations";

const TTL_MS = 30 * 60 * 1000; // 30 min

export type RecentOrdersCacheEntry = {
  orders: RecentOrder[];
  mtdLyOrders: RecentOrder[] | null;
  cachedAt: string; // ISO
};

const g = globalThis as typeof globalThis & {
  __ordersCache?: RecentOrdersCacheEntry | null;
};
if (g.__ordersCache === undefined) g.__ordersCache = null;

export function getCachedRecentOrders(): RecentOrdersCacheEntry | null {
  const cache = g.__ordersCache ?? null;
  if (!cache) return null;
  const age = Date.now() - new Date(cache.cachedAt).getTime();
  if (age > TTL_MS) {
    g.__ordersCache = null;
    return null;
  }
  return cache;
}

export function setCachedRecentOrders(
  orders: RecentOrder[],
  mtdLyOrders: RecentOrder[] | null = null
): void {
  g.__ordersCache = {
    orders,
    mtdLyOrders,
    cachedAt: new Date().toISOString(),
  };
}

export function clearOrdersCache(): void {
  g.__ordersCache = null;
}

export function getOrdersCacheAge(): number | null {
  const cache = g.__ordersCache ?? null;
  if (!cache) return null;
  return Date.now() - new Date(cache.cachedAt).getTime();
}
