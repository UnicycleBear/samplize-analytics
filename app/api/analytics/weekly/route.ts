import { getCachedWeekly, writeWeeklyCache } from "@/lib/weeklyCache";
import {
  startBulkOperation,
  pollBulkOperation,
  downloadAndParseJSONL,
} from "@/lib/bulkOperations";
import { startOfWeek, format, getISOWeek, getISOWeekYear } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const cached = await getCachedWeekly();
  if (cached) {
    return Response.json(cached);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseMessage({ stage: "starting" })));
        const now = new Date();
        const endDate = format(now, "yyyy-MM-dd");
        const startDate = format(new Date(now.getFullYear() - 1, 0, 1), "yyyy-MM-dd");
        await startBulkOperation(startDate, endDate);
        controller.enqueue(encoder.encode(sseMessage({ stage: "polling" })));
        const downloadUrl = await pollBulkOperation();
        controller.enqueue(encoder.encode(sseMessage({ stage: "downloading" })));
        if (!downloadUrl) {
          const payload = { weeklySalesByYear: [], cachedAt: new Date().toISOString() };
          await writeWeeklyCache(payload);
          controller.enqueue(encoder.encode(sseMessage({ stage: "done", ...payload })));
          controller.close();
          return;
        }
        const rows = await downloadAndParseJSONL(downloadUrl);
        const weekBuckets: Record<string, number> = {};
        for (const row of rows) {
          if (!row.createdAt) continue;
          const d = new Date(row.createdAt);
          const weekStart = startOfWeek(d, { weekStartsOn: 1 });
          const key = format(weekStart, "yyyy-MM-dd");
          weekBuckets[key] = (weekBuckets[key] ?? 0) + row.totalPrice;
        }
        const weekly = Object.entries(weekBuckets).map(([weekStart, revenue]) => ({
          weekStart,
          revenue,
        }));
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
        const payload = {
          weeklySalesByYear,
          cachedAt: new Date().toISOString(),
        };
        await writeWeeklyCache(payload);
        controller.enqueue(encoder.encode(sseMessage({ stage: "done", ...payload })));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(sseMessage({ stage: "error", error: message }))
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
    },
  });
}
