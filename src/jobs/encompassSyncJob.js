const LoanApplication = require('../models/LoanApplication');
const EncompassSyncLog = require('../models/EncompassSyncLog');
const LoanContact = require('../models/LoanContact');
const encompassService = require('../services/encompassService');
const logger = require('../utils/logger');

/**
 * Scheduled job to sync active loans with Encompass
 * Run every 15 minutes for loans that need syncing
 */
async function syncActiveLoans() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Find loans that need syncing:
    // 1. Have encompassLoanId
    // 2. Status is not 'funded' (still active)
    // 3. Haven't been synced in last 15 minutes
    const loansToSync = await LoanApplication.find({
      encompassLoanId: { $exists: true, $ne: null },
      status: { $ne: 'funded' },
      $or: [
        { lastEncompassSync: { $lt: fifteenMinutesAgo } },
        { lastEncompassSync: null },
      ],
    }).limit(50); // Batch size to avoid overwhelming the API

    logger.info(`Starting Encompass sync for ${loansToSync.length} loans`);

    const results = await Promise.allSettled(
      loansToSync.map((loan) => syncSingleLoan(loan))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('Encompass sync batch completed', { successful, failed, total: loansToSync.length });

    return { successful, failed, total: loansToSync.length };
  } catch (err) {
    logger.error('Encompass sync batch failed', { error: err.message });
    throw err;
  }
}

/**
 * Sync a single loan with Encompass
 */
async function syncSingleLoan(loan) {
  const startTime = Date.now();
  const syncLog = await EncompassSyncLog.create({
    loan: loan._id,
    syncType: 'full',
    direction: 'inbound',
    encompassLoanId: loan.encompassLoanId,
  });

  try {
    // Fetch data from Encompass
    const [loanDetails, milestones, contacts] = await Promise.all([
      encompassService.getLoanDetails(loan.encompassLoanId),
      encompassService.getLoanMilestones(loan.encompassLoanId),
      encompassService.getLoanContacts(loan.encompassLoanId),
    ]);

    // Update loan details
    loan.milestones = milestones;
    loan.lastEncompassSync = new Date();
    loan.encompassData = loanDetails;
    await loan.save();

    // Update or create contacts
    await Promise.all(
      contacts.map(async (contact) => {
        await LoanContact.findOneAndUpdate(
          { loan: loan._id, role: contact.role },
          { ...contact, loan: loan._id },
          { upsert: true, new: true }
        );
      })
    );

    // Update sync log
    syncLog.status = 'success';
    syncLog.syncDuration = Date.now() - startTime;
    syncLog.dataSnapshot = { milestones, contactsCount: contacts.length };
    await syncLog.save();

    logger.info('Loan synced successfully', {
      loanId: loan._id,
      encompassLoanId: loan.encompassLoanId,
      duration: syncLog.syncDuration,
    });

    return { success: true, loanId: loan._id };
  } catch (err) {
    syncLog.status = 'failed';
    syncLog.errorMessage = err.message;
    syncLog.syncDuration = Date.now() - startTime;
    await syncLog.save();

    logger.error('Loan sync failed', {
      loanId: loan._id,
      encompassLoanId: loan.encompassLoanId,
      error: err.message,
    });

    throw err;
  }
}

/**
 * Start the scheduled sync job
 * Runs every 15 minutes
 */
function startEncompassSyncScheduler() {
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  // Run immediately on startup
  syncActiveLoans().catch((err) => {
    logger.error('Initial Encompass sync failed', { error: err.message });
  });

  // Then run every 15 minutes
  setInterval(() => {
    syncActiveLoans().catch((err) => {
      logger.error('Scheduled Encompass sync failed', { error: err.message });
    });
  }, FIFTEEN_MINUTES);

  logger.info('Encompass sync scheduler started (runs every 15 minutes)');
}

module.exports = {
  syncActiveLoans,
  syncSingleLoan,
  startEncompassSyncScheduler,
};
