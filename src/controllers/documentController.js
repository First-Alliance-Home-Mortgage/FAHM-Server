const { validationResult } = require('express-validator');
const createError = require('http-errors');
const Document = require('../models/Document');
const defaults = require('../config/defaults');
const { audit } = require('../utils/audit');

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

    const { loan, name, type = 'pdf', url, size, hash } = req.body;

    if (!defaults.upload.allowedTypes.includes(type)) {
      return next(createError(400, `Unsupported file type ${type}`));
    }

    if (size && Number(size) > defaults.upload.maxSizeBytes) {
      return next(createError(413, 'File too large (max 20MB)'));
    }

    if (!hash) {
      return next(createError(400, 'File hash is required for duplicate detection'));
    }

    const existing = await Document.findOne({ loan, hash });
    if (existing) {
      await audit(
        {
          action: 'document.upload.duplicate',
          entityType: 'Document',
          entityId: existing._id.toString(),
          metadata: { loan, name, type, size },
        },
        req
      );
      // Idempotent response for duplicates: return the existing record
      return res.status(200).json(existing);
    }

    const scannedAt = new Date();
    const scanned = true; // Placeholder until AV scanner is integrated.
    const tempBlobExpiresAt = new Date(Date.now() + defaults.upload.tempBlobRetentionHours * 60 * 60 * 1000);

    const doc = await Document.create({
      loan,
      uploadedBy: req.user._id,
      name,
      type,
      url,
      size,
      hash,
      status: 'pending',
      scanned,
      scannedAt,
      tempBlobExpiresAt,
    });

    await audit(
      {
        action: 'document.upload',
        entityType: 'Document',
        entityId: doc._id.toString(),
        metadata: { loan, name, type, size },
      },
      req
    );

    return res.status(201).json(doc);
  } catch (err) {
    await audit(
      {
        action: 'document.upload',
        entityType: 'Document',
        status: 'error',
        metadata: { message: err.message },
      },
      req
    );
    return next(err);
  }
};

exports.markSynced = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return next(createError(404, 'Document not found'));
    doc.status = 'synced';
    await doc.save();
    await audit(
      {
        action: 'document.synced',
        entityType: 'Document',
        entityId: doc._id.toString(),
        metadata: { loan: doc.loan },
      },
      req
    );
    return res.json(doc);
  } catch (err) {
    return next(err);
  }
};

