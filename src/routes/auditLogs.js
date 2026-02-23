const express = require('express');
const router = express.Router();
const auditLogsController = require('../controllers/auditLogsController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/v1/audit-logs/consent
router.get('/consent', authenticate, authorize({ roles: ['admin'], capabilities: ['audit:view'] }), auditLogsController.getConsentLogs);

// GET /api/v1/audit-logs/crm
router.get('/crm', authenticate, authorize({ roles: ['admin'], capabilities: ['audit:view'] }), auditLogsController.getCrmLogs);

// GET /api/v1/audit-logs/credit
router.get('/credit', authenticate, authorize({ roles: ['admin'], capabilities: ['audit:view'] }), auditLogsController.getCreditLogs);

module.exports = router;
