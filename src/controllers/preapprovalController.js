const createError = require('http-errors');
const LoanApplication = require('../models/LoanApplication');
const { audit } = require('../utils/audit');

// Placeholder generator; replace with real templating/PDF generation.
function buildLetterPayload(loan, user) {
  const issuedAt = new Date();
  return {
    loanId: loan._id,
    borrower: loan.borrower,
    amount: loan.amount,
    status: loan.status,
    issuedBy: user._id,
    issuedAt,
    version: `${issuedAt.getTime()}`,
    url: `https://cdn.example.com/preapprovals/${loan._id}-${issuedAt.getTime()}.pdf`,
  };
}

exports.generate = async (req, res, next) => {
  try {
    const loan = await LoanApplication.findById(req.params.id);
    if (!loan) return next(createError(404, 'Loan not found'));

    // In real implementation, enforce role-based control (LO/BM/Admin) and fetch Encompass data.
    const letter = buildLetterPayload(loan, req.user);

    await audit(
      {
        action: 'preapproval.generate',
        entityType: 'LoanApplication',
        entityId: loan._id.toString(),
        metadata: { letterUrl: letter.url, version: letter.version },
      },
      req
    );

    return res.status(201).json(letter);
  } catch (err) {
    await audit(
      {
        action: 'preapproval.generate',
        entityType: 'LoanApplication',
        status: 'error',
        metadata: { message: err.message },
      },
      req
    );
    return next(err);
  }
};

