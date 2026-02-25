import express from 'express';
import cors from 'cors';
import net from 'net';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// ─── Global Middleware ──────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    Success: false,
    Message: 'Route not found',
    Object: null,
    Errors: ['The requested endpoint does not exist'],
  });
});

// ─── Global Error Handler ───────────────────────────────────
app.use(errorHandler);

// ─── Redis connectivity check ───────────────────────────────
function checkRedis(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.on('error', () => { clearTimeout(timer); resolve(false); });
  });
}

// ─── Start Server ───────────────────────────────────────────
const startServer = async () => {
  try {
    // Start the Express server
    app.listen(config.port, () => {
      console.log(`🚀 News API Server running on port ${config.port}`);
      console.log(`📍 Health check: http://localhost:${config.port}/health`);
      console.log(`📍 API base URL: http://localhost:${config.port}/api`);
    });

    // Only initialize BullMQ if Redis is actually reachable
    const redisAvailable = await checkRedis('127.0.0.1', 6379);
    if (redisAvailable) {
      const { scheduleDailyAggregation, createAnalyticsWorker } = await import('./jobs/analytics.job');
      createAnalyticsWorker();
      await scheduleDailyAggregation();
      console.log('📊 Analytics engine initialized (Redis connected)');
    } else {
      console.warn('⚠️  Redis not available — BullMQ job queue disabled.');
      console.warn('   Using fallback: in-process analytics aggregation.');

      // Import and run the fallback aggregation immediately
      const { runAggregationNow } = await import('./jobs/aggregation.fallback');
      await runAggregationNow();

      // Schedule the fallback aggregation to run every 5 minutes
      setInterval(async () => {
        await runAggregationNow();
      }, 5 * 60 * 1000);
      console.log('📊 Fallback aggregation scheduled (every 5 minutes)');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
