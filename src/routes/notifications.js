const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/', notificationController.list);
router.post(
  '/',
  [body('title').notEmpty(), body('user').optional().isMongoId(), body('type').optional().isString()],
  notificationController.create
);
router.post('/:id/read', notificationController.markRead);

module.exports = router;

