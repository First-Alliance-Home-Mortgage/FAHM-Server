const express = require('express');
const authRoutes = require('./auth');
const loanRoutes = require('./loans');
const documentRoutes = require('./documents');
const notificationRoutes = require('./notifications');
const userRoutes = require('./users');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/loans', loanRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);

module.exports = router;

