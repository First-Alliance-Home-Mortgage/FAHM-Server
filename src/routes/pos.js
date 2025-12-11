const express = require('express');
const { authenticate } = require('../middleware/auth');
const posController = require('../controllers/posController');

const router = express.Router();

router.use(authenticate);

router.post('/handoff', posController.createHandoff);

module.exports = router;

