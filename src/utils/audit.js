const AuditLog = require('../models/AuditLog');

/**
 * Persist an audit log entry.
 * @param {Object} params
 * @param {string} params.action - action name (e.g., 'document.upload', 'notification.create')
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {'success'|'error'} [params.status='success']
 * @param {Object} [params.metadata]
 * @param {Object} [req] - Express request (for user, ip, ua)
 */
async function audit(params, req) {
  try {
    const entry = {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      status: params.status || 'success',
      metadata: params.metadata,
    };
    if (req) {
      entry.user = req.user?._id;
      entry.ip = req.ip;
      entry.userAgent = req.headers['user-agent'];
    }
    await AuditLog.create(entry);
  } catch (err) {
    // Avoid throwing in audit path; log to console as a fallback.
    // In production, wire to real logger/metrics.
    // eslint-disable-next-line no-console
    console.error('audit log failed', err.message);
  }
}

module.exports = { audit };

