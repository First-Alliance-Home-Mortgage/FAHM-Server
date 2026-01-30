const { validationResult } = require('express-validator');
const createError = require('http-errors');
const LoanApplication = require('../models/LoanApplication');
const roles = require('../config/roles');
const { audit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role?.slug === roles.BORROWER) {
      filter.borrower = req.user._id;
    }
    const loans = await LoanApplication.find(filter)
      .populate('borrower', 'name email')
      .populate('assignedOfficer', 'name email role');
    await audit({ action: 'loan.list', entityType: 'LoanApplication', metadata: { count: loans.length } }, req);
    return res.json(loans);
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

