// Get all messages for the authenticated user
exports.getMyMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user._id;
    const query = {
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    };
    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'name email')
        .populate('recipient', 'name email'),
      Message.countDocuments(query)
    ]);
    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
};
const Message = require('../models/Message');
const { validationResult } = require('express-validator');
const createError = require('http-errors');

exports.getMessagesByLoan = async (req, res, next) => {
  try {
    const messages = await Message.find({ loan: req.params.loanId })
      .sort({ createdAt: 1 })
      .populate('sender', 'name email')
      .populate('recipient', 'name email');
    res.json({ messages });
  } catch (err) {
    next(err);
  }
};

exports.getMessageById = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'name email')
      .populate('recipient', 'name email');
    if (!message) return next(createError(404, 'Message not found'));
    res.json({ message });
  } catch (err) {
    next(err);
  }
};

exports.createMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(createError(400, { errors: errors.array() }));
    const { loan, recipient, content, messageType, metadata } = req.body;
    const message = await Message.create({
      loan,
      sender: req.user._id,
      recipient,
      content,
      messageType,
      metadata,
    });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!message) return next(createError(404, 'Message not found'));
    res.json({ message });
  } catch (err) {
    next(err);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) return next(createError(404, 'Message not found'));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
