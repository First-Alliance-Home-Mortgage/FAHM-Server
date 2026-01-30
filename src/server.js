const http = require('http');
const app = require('./app');
const connectMongo = require('./db/mongoose');
const { port } = require('./config/env');
const logger = require('./utils/logger');
const { startEncompassSyncScheduler } = require('./jobs/encompassSyncJob');
const { startCRMSyncScheduler } = require('./jobs/crmSyncJob');
const { startFCRARetentionScheduler } = require('./jobs/fcraRetentionJob');
const { startRateSyncScheduler } = require('./jobs/rateSyncJob');
const { startMetricsAggregationScheduler } = require('./jobs/metricsAggregationJob');
const rateAlertScheduler = require('./schedulers/rateAlertScheduler');
const { contentBroadcaster } = require('./socket/index');


const server = http.createServer(app);

const start = async () => {
  try {
    await connectMongo();

    // Start Encompass auto-sync scheduler
    startEncompassSyncScheduler();

    // Start CRM auto-sync scheduler
    startCRMSyncScheduler();

    // Start FCRA retention policy scheduler
    startFCRARetentionScheduler();

    // Start Optimal Blue rate sync scheduler
    startRateSyncScheduler();

    // Start metrics aggregation scheduler
    startMetricsAggregationScheduler();

    // Start rate alert scheduler
    rateAlertScheduler.start();

    // Attach WebSocket content update broadcaster
    contentBroadcaster.attach(server);

    server.listen(port, () => {
      logger.info(`FAHM API listening on port ${port}`);
      logger.info(`WebSocket endpoint: ws://localhost:${port}/ws/content`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  contentBroadcaster.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();

