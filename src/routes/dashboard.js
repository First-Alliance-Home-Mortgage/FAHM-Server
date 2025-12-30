const express = require('express');
const { query } = require('express-validator');
const router = express.Router();
// Removed unused 'query' import
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const roles = require('../config/roles');

/**
 * @swagger
 * tags:
 *   name: Performance Dashboard
 *   description: Power BI embedded analytics, KPIs, and performance metrics
 */

/**
 * @swagger
 * /api/v1/dashboard/reports:
 *   get:
 *     summary: Get available dashboard reports for user
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available reports retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/reports', authenticate, dashboardController.getAvailableReports);

/**
 * @swagger
 * /api/v1/dashboard/reports/{reportId}/embed:
 *   get:
 *     summary: Get Power BI embed configuration for report
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dashboard report ID
 *     responses:
 *       200:
 *         description: Embed configuration retrieved successfully
 *       404:
 *         description: Report not found
 */
router.get('/reports/:reportId/embed', authenticate, dashboardController.getReportEmbedConfig);

/**
 * @swagger
 * /api/v1/dashboard/reports/{reportId}/refresh:
 *   post:
 *     summary: Refresh Power BI dataset (Admin/BM only)
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dataset refresh triggered successfully
 *       403:
 *         description: Access denied
 */
router.post(
  '/reports/:reportId/refresh',
  authenticate,
  authorize(roles.ADMIN, roles.BRANCH_MANAGER),
  dashboardController.refreshReport
);

/**
 * @swagger
 * /api/v1/dashboard/metrics:
 *   get:
 *     summary: Get dashboard metrics/KPIs
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metricType
 *         schema:
 *           type: string
 *           enum: [applications, preapprovals, funding_rate, cycle_time, lead_volume, active_pipeline, conversion_rate, avg_loan_amount, pull_through_rate]
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly]
 *           default: monthly
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: aggregationLevel
 *         schema:
 *           type: string
 *           enum: [user, branch, region, company]
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
router.get('/metrics', authenticate, dashboardController.getMetrics);

/**
 * @swagger
 * /api/v1/dashboard/my-kpis:
 *   get:
 *     summary: Get current user's personal KPI summary
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *     responses:
 *       200:
 *         description: User KPIs retrieved successfully
 */
router.get('/my-kpis', authenticate, dashboardController.getMyKPIs);

/**
 * @swagger
 * /api/v1/dashboard/branch-performance:
 *   get:
 *     summary: Get branch performance summary (BM/Admin only)
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly]
 *           default: monthly
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Branch performance retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get(
  '/branch-performance',
  authenticate,
  authorize(roles.BRANCH_MANAGER, roles.ADMIN),
  dashboardController.getBranchPerformance
);

/**
 * @swagger
 * /api/v1/dashboard/regional-performance:
 *   get:
 *     summary: Get regional performance summary (Admin only)
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly]
 *           default: monthly
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Regional performance retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get(
  '/regional-performance',
  authenticate,
  authorize(roles.ADMIN),
  dashboardController.getRegionalPerformance
);

/**
 * @swagger
 * /api/v1/dashboard/leaderboard:
 *   get:
 *     summary: Get leaderboard (top performing LOs)
 *     tags: [Performance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metricType
 *         schema:
 *           type: string
 *           enum: [applications, preapprovals, funding_rate, cycle_time]
 *           default: applications
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 */
router.get('/leaderboard', authenticate, dashboardController.getLeaderboard);

module.exports = router;
