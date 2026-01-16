const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');


// Get all messages for the authenticated user
router.get('/my-messages', authenticate, messageController.getMyMessages);

// Get all messages for a loan
router.get('/loan/:loanId', authenticate, messageController.getMessagesByLoan);

// Get a single message by id
router.get('/:id', authenticate, messageController.getMessageById);

// Create a new message
router.post('/', authenticate, messageController.createMessage);

// Mark a message as read
router.patch('/:id/read', authenticate, messageController.markAsRead);

// Delete a message
router.delete('/:id', authenticate, messageController.deleteMessage);

module.exports = router;
