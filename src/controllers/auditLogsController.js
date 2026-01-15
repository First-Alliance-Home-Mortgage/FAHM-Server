const AuditLog = require('../models/AuditLog');
const createError = require('http-errors');

// GET /api/v1/audit-logs/consent
exports.getConsentLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ entityType: 'consent' })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(createError(500, 'Failed to fetch consent audit logs'));
  }
};

// GET /api/v1/audit-logs/crm
exports.getCrmLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ entityType: 'crm' })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(createError(500, 'Failed to fetch CRM audit logs'));
  }
};

// GET /api/v1/audit-logs/credit
exports.getCreditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ entityType: 'credit' })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(createError(500, 'Failed to fetch credit audit logs'));
  }
};
