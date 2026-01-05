const express = require('express');
const authRoutes = require('./auth');
const loanRoutes = require('./loans');
const documentRoutes = require('./documents');
const documentUploadRoutes = require('./documentUpload');
const notificationRoutes = require('./notifications');
const userRoutes = require('./users');
const posRoutes = require('./pos');
const posLinkRoutes = require('./posLink');
const calculatorRoutes = require('./calculator');
const encompassRoutes = require('./encompass');
const crmRoutes = require('./crm');
const creditRoutes = require('./credit');
const rateRoutes = require('./rates');
const dashboardRoutes = require('./dashboard');
const businessCardRoutes = require('./businessCards');
const preapprovalRoutes = require('./preapproval');
const consentRoutes = require('./consent');
const personaViewRoutes = require('./personaViews');
const referralSourceRoutes = require('./referralSources');
const smsRoutes = require('./sms');
const rateAlertRoutes = require('./rateAlerts');

const menuRoutes = require('./menu');
const chatbotRoutes = require('./chatbot');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/loans', loanRoutes);
router.use('/documents', documentRoutes);
router.use('/document-uploads', documentUploadRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/pos', posRoutes);
router.use('/pos-link', posLinkRoutes);
router.use('/calculator', calculatorRoutes);
router.use('/encompass', encompassRoutes);
router.use('/crm', crmRoutes);
router.use('/credit', creditRoutes);
router.use('/rates', rateRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/business-cards', businessCardRoutes);
router.use('/preapproval', preapprovalRoutes);
router.use('/consent', consentRoutes);
router.use('/persona-views', personaViewRoutes);
router.use('/referral-sources', referralSourceRoutes);
router.use('/sms', smsRoutes);
router.use('/rate-alerts', rateAlertRoutes);
router.use('/chatbot', chatbotRoutes);

router.use('/menus', menuRoutes);

module.exports = router;

