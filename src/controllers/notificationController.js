const createError = require('http-errors');
const Notification = require('../models/Notification');
const defaults = require('../config/defaults');
const { audit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(notifications);
  } catch (err) {
    return next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notif) return res.status(404).json({ message: 'Not found' });
    notif.read = true;
    await notif.save();
    await audit(
      {
        action: 'notification.read',
        entityType: 'Notification',
        entityId: notif._id.toString(),
      },
      req
    );
    return res.json(notif);
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    // Quiet hours check (server local time) unless explicitly overridden
    const hour = new Date().getHours();
    const { start, end } = defaults.notifications.quietHours;
    const inQuietHours = start <= hour || hour < end;
    const forceSend = Boolean(req.body.forceSend);

    if (inQuietHours && !forceSend) {
      return next(createError(429, 'Quiet hours in effect; notification suppressed'));
    }

    // Throttle per user per 24h window
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await Notification.countDocuments({ user: req.body.user || req.user._id, createdAt: { $gte: since } });
    if (recentCount >= defaults.notifications.throttlePerEventPerDay && !forceSend) {
      return next(createError(429, 'Notification throttle limit reached'));
    }

    const notif = await Notification.create({
      user: req.body.user || req.user._id,
      type: req.body.type,
      title: req.body.title,
      body: req.body.body,
      metadata: req.body.metadata,
    });
    await audit(
      {
        action: 'notification.create',
        entityType: 'Notification',
        entityId: notif._id.toString(),
        metadata: { type: notif.type, user: notif.user },
      },
      req
    );
    return res.status(201).json(notif);
  } catch (err) {
    await audit(
      {
        action: 'notification.create',
        entityType: 'Notification',
        status: 'error',
        metadata: { message: err.message },
      },
      req
    );
    return next(err);
  }
};

