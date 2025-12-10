const express = require('express');
const { body } = require('express-validator');
const roles = require('../config/roles');
const authController = require('../controllers/authController');

const router = express.Router();

const passwordValidator = body('password').isLength({ min: 6 }).withMessage('Password min 6 chars');

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    passwordValidator,
    // Normalize role to lowercase before validating so clients can send either case.
    body('role').optional().toLowerCase().isIn(Object.values(roles)),
  ],
  authController.register
);

router.post(
  '/login',
  [body('email').isEmail(), passwordValidator.withMessage('Password required')],
  authController.login
);

module.exports = router;

