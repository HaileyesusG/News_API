import { Queue, Worker } from 'bullmq';
import prisma from '../config/database';
import { config } from '../config';

const QUEUE_NAME = 'analytics-aggregation';

// Redis connection config for BullMQ
const connection = {
  url: config.redisUrl,
};

// Create the queue
export const analyticsQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Schedule daily analytics aggregation job
 * Runs daily at midnight GMT
 */
export const scheduleDailyAggregation = async () => {
  // Add a repeatable job that runs at midnight GMT every day
  await analyticsQueue.add(
    'aggregate-daily-reads',
    {},
    {
      repeat: {
        pattern: '0 0 * * *', // Cron: midnight every day
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );

  console.log('📊 Daily analytics aggregation job scheduled (midnight GMT)');
};

/**
 * Process the aggregation: sum ReadLog entries per article per day
 * and upsert into DailyAnalytics
 */
export const processAggregation = async () => {
  console.log('📊 Starting daily analytics aggregation...');

  // Get yesterday's date in GMT
  const now = new Date();
  const yesterday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ));
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  try {
    // Aggregate read logs for yesterday (GMT)
    const aggregatedReads = await prisma.readLog.groupBy({
      by: ['articleId'],
      where: {
        readAt: {
          gte: yesterday,
          lt: today,
        },
      },
      _count: {
        id: true,
      },
    });

    console.log(`📊 Found ${aggregatedReads.length} articles with reads for ${yesterday.toISOString().split('T')[0]}`);

    // Upsert each aggregation into DailyAnalytics
    for (const entry of aggregatedReads) {
      await prisma.dailyAnalytics.upsert({
        where: {
          articleId_date: {
            articleId: entry.articleId,
            date: yesterday,
          },
        },
        update: {
          viewCount: entry._count.id,
        },
        create: {
          articleId: entry.articleId,
          viewCount: entry._count.id,
          date: yesterday,
        },
      });
    }

    console.log('📊 Daily analytics aggregation completed successfully');
  } catch (error) {
    console.error('📊 Analytics aggregation failed:', error);
    throw error;
  }
};

/**
 * Create the analytics worker to process jobs
 */
export const createAnalyticsWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'aggregate-daily-reads') {
        await processAggregation();
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`📊 Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`📊 Job ${job?.id} failed:`, err);
  });

  return worker;
};

/**
 * Trigger manual aggregation (useful for testing)
 */
export const triggerManualAggregation = async () => {
  await analyticsQueue.add('aggregate-daily-reads', {}, {
    removeOnComplete: true,
    removeOnFail: true,
  });
};
