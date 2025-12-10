const Notification = require('../models/Notification');

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
    return res.json(notif);
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const notif = await Notification.create({
      user: req.body.user || req.user._id,
      type: req.body.type,
      title: req.body.title,
      body: req.body.body,
      metadata: req.body.metadata,
    });
    return res.status(201).json(notif);
  } catch (err) {
    return next(err);
  }
};

