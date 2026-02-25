import prisma from '../config/database';

/**
 * Aggregate ALL ReadLog entries into DailyAnalytics.
 * Groups reads by articleId + date (GMT) and upserts into DailyAnalytics.
 * This runs without Redis/BullMQ — used as a fallback or manual trigger.
 */
export async function runAggregationNow(): Promise<void> {
  console.log('📊 Running full analytics aggregation (no Redis required)...');

  try {
    // Get all read logs, grouped by articleId
    // We use raw groupBy with date truncation to group by day (GMT)
    const allReadLogs = await prisma.readLog.findMany({
      select: {
        articleId: true,
        readAt: true,
      },
    });

    if (allReadLogs.length === 0) {
      console.log('📊 No read logs found to aggregate.');
      return;
    }

    // Group by articleId + date (GMT day)
    const grouped: Record<string, Record<string, number>> = {};

    for (const log of allReadLogs) {
      const dateKey = new Date(Date.UTC(
        log.readAt.getUTCFullYear(),
        log.readAt.getUTCMonth(),
        log.readAt.getUTCDate()
      )).toISOString();

      if (!grouped[log.articleId]) {
        grouped[log.articleId] = {};
      }
      grouped[log.articleId][dateKey] = (grouped[log.articleId][dateKey] || 0) + 1;
    }

    // Upsert each entry into DailyAnalytics
    let upsertCount = 0;
    for (const [articleId, dates] of Object.entries(grouped)) {
      for (const [dateStr, viewCount] of Object.entries(dates)) {
        const date = new Date(dateStr);
        await prisma.dailyAnalytics.upsert({
          where: {
            articleId_date: {
              articleId,
              date,
            },
          },
          update: {
            viewCount,
          },
          create: {
            articleId,
            date,
            viewCount,
          },
        });
        upsertCount++;
      }
    }

    console.log(`📊 Aggregation complete: ${upsertCount} DailyAnalytics entries upserted from ${allReadLogs.length} read logs.`);
  } catch (error) {
    console.error('📊 Full aggregation failed:', error);
  }
}
