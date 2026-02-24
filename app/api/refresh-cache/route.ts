import { clearOrdersCache } from "@/lib/ordersCache";
import { refreshWeeklyCache } from "@/lib/weeklyCache";
import { triggerBulkFetchNow } from "@/lib/bulkPoller";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  clearOrdersCache();
  triggerBulkFetchNow();
  const payload = await refreshWeeklyCache();
  return Response.json({
    success: true,
    updatedAt: payload.cachedAt,
  });
}
