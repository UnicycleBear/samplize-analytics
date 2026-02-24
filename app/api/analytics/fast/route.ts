import {
  getCachedRecentOrders,
} from "@/lib/ordersCache";
import { getShopifyConfig } from "@/lib/shopify";
import { computeMetricsFromRecentOrders, type StoreMetrics } from "@/lib/analytics";
import { ensureBulkPollerStarted } from "@/lib/bulkPoller";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = getShopifyConfig();
  if (!config) {
    return Response.json(
      { error: "Missing SAMPLIZE_STORE_URL or SAMPLIZE_API_KEY" },
      { status: 500 }
    );
  }

  const cached = getCachedRecentOrders();
  if (cached) {
    const metrics = computeMetricsFromRecentOrders(
      cached.orders,
      cached.mtdLyOrders,
      "samplize",
      "Samplize",
      new Date()
    );
    return Response.json({
      metrics,
      cachedAt: cached.cachedAt,
    });
  }

  ensureBulkPollerStarted();
  return Response.json({ loading: true });
}
