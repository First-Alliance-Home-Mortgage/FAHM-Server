const express = require('express');
const authRoutes = require('./auth');
const loanRoutes = require('./loans');
const documentRoutes = require('./documents');
const notificationRoutes = require('./notifications');
const userRoutes = require('./users');
const posRoutes = require('./pos');
const calculatorRoutes = require('./calculator');
const encompassRoutes = require('./encompass');
const crmRoutes = require('./crm');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/loans', loanRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/pos', posRoutes);
router.use('/calculator', calculatorRoutes);
router.use('/encompass', encompassRoutes);
router.use('/crm', crmRoutes);

module.exports = router;

