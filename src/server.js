const app = require('./app');
const connectMongo = require('./db/mongoose');
const { port } = require('./config/env');
const logger = require('./utils/logger');
const { startEncompassSyncScheduler } = require('./jobs/encompassSyncJob');
const { startCRMSyncScheduler } = require('./jobs/crmSyncJob');

const start = async () => {
  try {
    await connectMongo();
    
    // Start Encompass auto-sync scheduler
    startEncompassSyncScheduler();
    
    // Start CRM auto-sync scheduler
    startCRMSyncScheduler();
    
    app.listen(port, () => {
      logger.info(`FAHM API listening on port ${port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
};

start();

