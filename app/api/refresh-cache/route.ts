import { clearOrdersCache } from "@/lib/ordersCache";
import { refreshWeeklyCache } from "@/lib/weeklyCache";
import { triggerBulkFetchNow } from "@/lib/bulkPoller";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  clearOrdersCache();
  triggerBulkFetchNow();
  refreshWeeklyCache().catch((e) =>
    console.error("[refresh-cache] weekly refresh error:", e)
  );
  return Response.json({ success: true, updatedAt: new Date().toISOString() });
}
