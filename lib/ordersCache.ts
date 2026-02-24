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

let cache: RecentOrdersCacheEntry | null = null;

export function getCachedRecentOrders(): RecentOrdersCacheEntry | null {
  if (!cache) return null;
  const age = Date.now() - new Date(cache.cachedAt).getTime();
  if (age > TTL_MS) {
    cache = null;
    return null;
  }
  return cache;
}

export function setCachedRecentOrders(
  orders: RecentOrder[],
  mtdLyOrders: RecentOrder[] | null = null
): void {
  cache = {
    orders,
    mtdLyOrders,
    cachedAt: new Date().toISOString(),
  };
}

export function clearOrdersCache(): void {
  cache = null;
}

export function getOrdersCacheAge(): number | null {
  if (!cache) return null;
  return Date.now() - new Date(cache.cachedAt).getTime();
}
