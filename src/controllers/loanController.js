const { validationResult } = require('express-validator');
const createError = require('http-errors');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const roles = require('../config/roles');
const { audit } = require('../utils/audit');
const escapeRegex = require('../utils/escapeRegex');

exports.list = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { status, source, assignedOfficer, q, dateFrom, dateTo } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const sort = req.query.sort || '-createdAt';

    const filter = {};

    // Role-based scoping: borrowers only see their own loans
    if (req.user.role?.slug === roles.BORROWER) {
      filter.borrower = req.user._id;
    }

    // Filter by status (supports comma-separated: "processing,underwriting")
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    // Filter by loan source
    if (source) {
      filter.source = source;
    }

    // Filter by assigned officer
    if (assignedOfficer) {
      filter.assignedOfficer = assignedOfficer;
    }

    // Date range filter on createdAt
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Text search: borrower name/email or property address
    if (q) {
      const safeQ = escapeRegex(q);
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: safeQ, $options: 'i' } },
          { email: { $regex: safeQ, $options: 'i' } },
        ],
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      const searchConditions = [
        { propertyAddress: { $regex: safeQ, $options: 'i' } },
      ];
      if (userIds.length > 0) {
        searchConditions.push({ borrower: { $in: userIds } });
      }
      filter.$or = searchConditions;
    }

    const skip = (page - 1) * limit;
    const total = await LoanApplication.countDocuments(filter);
    const loans = await LoanApplication.find(filter)
      .populate('borrower', 'name email')
      .populate('assignedOfficer', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    await audit({ action: 'loan.list', entityType: 'LoanApplication', metadata: { count: loans.length, total, page } }, req);

    return res.json({
      data: loans,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    const loan = await LoanApplication.create({
      borrower: req.body.borrower || req.user._id,
      assignedOfficer: req.body.assignedOfficer,
      amount: req.body.amount,
      propertyAddress: req.body.propertyAddress,
      status: req.body.status,
      source: req.body.source,
      milestones: req.body.milestones || [],
    });
    await audit(
      {
        action: 'loan.create',
        entityType: 'LoanApplication',
        entityId: loan._id.toString(),
        metadata: { borrower: loan.borrower, amount: loan.amount },
      },
      req
    );
    return res.status(201).json(loan);
  } catch (err) {
    return next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, milestones } = req.body;
    const loan = await LoanApplication.findById(id);
    if (!loan) return next(createError(404, 'Loan not found'));
    if (status) loan.status = status;
    if (milestones) loan.milestones = milestones;
    await loan.save();
    await audit(
      {
        action: 'loan.updateStatus',
        entityType: 'LoanApplication',
        entityId: loan._id.toString(),
        metadata: { status, milestonesCount: milestones ? milestones.length : loan.milestones.length },
      },
      req
    );
    return res.json(loan);
  } catch (err) {
    return next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const loan = await LoanApplication.findById(req.params.id)
      .populate('borrower', 'name email')
      .populate('assignedOfficer', 'name email role');
    if (!loan) return next(createError(404, 'Loan not found'));
    await audit(
      { action: 'loan.get', entityType: 'LoanApplication', entityId: loan._id.toString() },
      req
    );
    return res.json(loan);
  } catch (err) {
    return next(err);
  }
};

