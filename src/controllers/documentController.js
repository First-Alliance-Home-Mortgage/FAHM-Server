const { validationResult } = require('express-validator');
const createError = require('http-errors');
const Document = require('../models/Document');

exports.listForLoan = async (req, res, next) => {
  try {
    const docs = await Document.find({ loan: req.params.loanId }).populate('uploadedBy', 'name email');
    return res.json(docs);
  } catch (err) {
    return next(err);
  }
};

exports.upload = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const doc = await Document.create({
      loan: req.body.loan,
      uploadedBy: req.user._id,
      name: req.body.name,
      type: req.body.type,
      url: req.body.url,
      status: 'pending',
    });
    return res.status(201).json(doc);
  } catch (err) {
    return next(err);
  }
};

exports.markSynced = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return next(createError(404, 'Document not found'));
    doc.status = 'synced';
    await doc.save();
    return res.json(doc);
  } catch (err) {
    return next(err);
  }
};

