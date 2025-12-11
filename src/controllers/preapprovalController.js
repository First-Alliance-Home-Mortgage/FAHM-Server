const PreapprovalLetter = require('../models/PreapprovalLetter');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const ReferralSource = require('../models/ReferralSource');
const encompassService = require('../services/encompassService');
const pdfGenerationService = require('../services/pdfGenerationService');
const azureBlobService = require('../services/azureBlobService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const createError = require('http-errors');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @desc    Generate preapproval letter
 * @route   POST /api/v1/preapproval/generate
 * @access  Private (Loan Officers, Admins)
 */
exports.generate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId, validityDays, conditions, branding } = req.body;

    // Fetch loan application
    const loan = await LoanApplication.findById(loanId)
      .populate('borrower', 'name email phone')
      .populate('assignedOfficer', 'name email phone nmls title')
      .populate('referralSource');

    if (!loan) {
      return next(createError(404, 'Loan application not found'));
    }

    // Authorization: Only assigned LO or admin
    if (
      req.user.role !== 'admin' &&
      loan.assignedOfficer?._id?.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to generate letter for this loan'));
    }

    // Fetch borrower data from Encompass if available
    let encompassData = {};
    if (loan.encompassLoanId) {
      try {
        encompassData = await encompassService.getLoanDetails(loan.encompassLoanId);
      } catch (error) {
        logger.warn('Failed to fetch Encompass data, using loan application data:', error);
      }
    }

    // Fetch referral source branding if available and co-branding is enabled
    let referralBranding = null;
    if (loan.referralSource) {
      try {
        const referralSource = loan.referralSource;
        if (referralSource.status === 'active' && 
            referralSource.isCoBrandingEnabled('preapproval')) {
          referralBranding = referralSource.getBrandingConfig();
        }
      } catch (error) {
        logger.warn('Failed to fetch referral source branding:', error);
      }
    }

    // Generate unique letter number
    const letterNumber = await PreapprovalLetter.generateLetterNumber();

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (validityDays || 90));

    // Prepare letter data
    const letterData = {
      loan: loan._id,
      borrower: loan.borrower._id,
      loanOfficer: loan.assignedOfficer._id,
      letterNumber,
      borrowerData: {
        primaryBorrower: {
          name: loan.borrower.name,
          email: loan.borrower.email,
          phone: loan.borrower.phone,
          address: encompassData.borrowerAddress || loan.propertyAddress,
          city: encompassData.borrowerCity || '',
          state: encompassData.borrowerState || '',
          zip: encompassData.borrowerZip || ''
        },
        coBorrower: encompassData.coBorrower || {}
      },
      loanData: {
        loanAmount: loan.loanAmount,
        purchasePrice: loan.purchasePrice || 0,
        downPayment: loan.downPayment || 0,
        propertyAddress: loan.propertyAddress,
        propertyCity: '',
        propertyState: '',
        propertyZip: '',
        propertyType: loan.propertyType || 'single_family',
        loanType: loan.loanType || 'conventional',
        interestRate: loan.interestRate,
        loanTerm: loan.loanTerm || 30,
        monthlyPayment: 0,
        estimatedClosingDate: loan.estimatedClosingDate
      },
      creditData: {
        creditScore: encompassData.creditScore || 0,
        hasVerifiedIncome: true,
        hasVerifiedAssets: true
      },
      referralSource: loan.referralSource?._id,
      branding: referralBranding || branding || {
        logo: 'https://fahm.com/logo.png',
        primaryColor: '#003B5C',
        secondaryColor: '#FF6B35',
        partnerLogo: referralBranding?.logo,
        partnerName: referralBranding?.name || referralBranding?.companyName
      },
      expirationDate,
      validityDays: validityDays || 90,
      conditions: conditions || [
        {
          description: 'Subject to satisfactory appraisal of the property',
          required: true
        },
        {
          description: 'Subject to verification of employment and income',
          required: true
        },
        {
          description: 'Subject to clear title and homeowner\'s insurance',
          required: true
        }
      ],
      signatures: {
        loanOfficerName: loan.assignedOfficer?.name || 'Loan Officer',
        loanOfficerTitle: loan.assignedOfficer?.title || 'Senior Loan Officer',
        loanOfficerNMLS: loan.assignedOfficer?.nmls || '000000',
        signedDate: new Date(),
        companyName: 'First Alliance Home Mortgage',
        companyNMLS: 'NMLS #00000'
      },
      status: 'generated',
      encompassData: {
        encompassLoanId: loan.encompassLoanId,
        lastSync: new Date(),
        syncStatus: 'synced'
      }
    };

    // Create letter record
    const letter = await PreapprovalLetter.create(letterData);

    // Generate PDF
    const pdfBuffer = await pdfGenerationService.generatePreapprovalLetter(letterData);

    // Upload to Azure Blob
    const blobName = `preapproval-letters/${loan._id}/${letterNumber}.pdf`;
    const blobUrl = await azureBlobService.uploadFile(
      blobName,
      pdfBuffer,
      'application/pdf'
    );

    // Update letter with PDF URL
    letter.pdfUrl = blobUrl;
    letter.pdfBlobName = blobName;
    await letter.save();

    logger.info('Preapproval letter generated', {
      letterId: letter._id,
      letterNumber,
      loanId: loan._id
    });

    res.status(201).json({
      success: true,
      data: {
        letter: {
          id: letter._id,
          letterNumber: letter.letterNumber,
          borrowerName: letter.borrowerData.primaryBorrower.name,
          loanAmount: letter.loanData.loanAmount,
          loanType: letter.loanData.loanType,
          expirationDate: letter.expirationDate,
          status: letter.status,
          pdfUrl: letter.pdfUrl,
          createdAt: letter.createdAt
        }
      },
      message: 'Preapproval letter generated successfully'
    });
  } catch (error) {
    logger.error('Error generating preapproval letter:', error);
    next(error);
  }
};

/**
 * @desc    Get preapproval letters for a loan
 * @route   GET /api/v1/preapproval/loan/:loanId
 * @access  Private
 */
exports.getByLoan = async (req, res, next) => {
  try {
    const { loanId } = req.params;

    // Fetch loan to check authorization
    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan application not found'));
    }

    // Authorization
    if (
      req.user.role === 'borrower' &&
      loan.borrower.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to view letters for this loan'));
    }

    const letters = await PreapprovalLetter.find({ loan: loanId, isActive: true })
      .populate('loanOfficer', 'name email phone nmls title')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: letters.length,
      data: { letters }
    });
  } catch (error) {
    logger.error('Error fetching preapproval letters:', error);
    next(error);
  }
};

/**
 * @desc    Get single preapproval letter
 * @route   GET /api/v1/preapproval/:id
 * @access  Private
 */
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;

    const letter = await PreapprovalLetter.findById(id)
      .populate('loan')
      .populate('borrower', 'name email phone')
      .populate('loanOfficer', 'name email phone nmls title');

    if (!letter) {
      return next(createError(404, 'Preapproval letter not found'));
    }

    // Authorization
    if (
      req.user.role === 'borrower' &&
      letter.borrower._id.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to view this letter'));
    }

    res.json({
      success: true,
      data: { letter }
    });
  } catch (error) {
    logger.error('Error fetching preapproval letter:', error);
    next(error);
  }
};

/**
 * @desc    Download preapproval letter PDF
 * @route   GET /api/v1/preapproval/:id/download
 * @access  Private
 */
exports.download = async (req, res, next) => {
  try {
    const { id } = req.params;

    const letter = await PreapprovalLetter.findById(id);
    if (!letter) {
      return next(createError(404, 'Preapproval letter not found'));
    }

    // Authorization
    if (
      req.user.role === 'borrower' &&
      letter.borrower.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to download this letter'));
    }

    // Check expiration
    if (letter.isExpired()) {
      return next(createError(410, 'This preapproval letter has expired'));
    }

    // Track view
    await letter.trackView(req.user.email, req.ip);

    // Download from Azure Blob
    const pdfStream = await azureBlobService.downloadFile(letter.pdfBlobName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Preapproval_Letter_${letter.letterNumber}.pdf"`
    );

    pdfStream.pipe(res);

    logger.info('Preapproval letter downloaded', {
      letterId: letter._id,
      letterNumber: letter.letterNumber,
      userId: req.user.userId
    });
  } catch (error) {
    logger.error('Error downloading preapproval letter:', error);
    next(error);
  }
};

/**
 * @desc    Share preapproval letter
 * @route   POST /api/v1/preapproval/:id/share
 * @access  Private
 */
exports.share = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { id } = req.params;
    const { method, recipient } = req.body;

    const letter = await PreapprovalLetter.findById(id)
      .populate('borrower', 'name email phone')
      .populate('loanOfficer', 'name email phone nmls title');

    if (!letter) {
      return next(createError(404, 'Preapproval letter not found'));
    }

    // Authorization
    if (
      req.user.role === 'borrower' &&
      letter.borrower._id.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to share this letter'));
    }

    // Check expiration
    if (letter.isExpired()) {
      return next(createError(410, 'This preapproval letter has expired'));
    }

    let result;

    if (method === 'email') {
      // Generate download link (SAS URL with 24 hour expiration)
      const downloadUrl = await azureBlobService.generateSasUrl(
        letter.pdfBlobName,
        24 * 60 // 24 hours in minutes
      );

      // Download PDF from blob for email attachment
      const pdfStream = await azureBlobService.downloadFile(letter.pdfBlobName);
      const chunks = [];
      for await (const chunk of pdfStream) {
        chunks.push(chunk);
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Send email with PDF attachment
      result = await emailService.sendPreapprovalLetter(
        recipient,
        letter.toObject(),
        pdfBuffer
      );

      await letter.markSent('email', recipient, req.user.userId);
    } else if (method === 'sms') {
      // Generate download link
      const downloadUrl = await azureBlobService.generateSasUrl(
        letter.pdfBlobName,
        24 * 60
      );

      // Send SMS with download link
      result = await smsService.sendPreapprovalLink(
        recipient,
        letter.toObject(),
        downloadUrl
      );

      await letter.markSent('sms', recipient, req.user.userId);
    } else if (method === 'link') {
      // Generate shareable link
      const downloadUrl = await azureBlobService.generateSasUrl(
        letter.pdfBlobName,
        24 * 60
      );

      result = { downloadUrl };
      await letter.markSent('link', recipient || 'Generated', req.user.userId);
    } else {
      return next(createError(400, 'Invalid sharing method'));
    }

    logger.info('Preapproval letter shared', {
      letterId: letter._id,
      letterNumber: letter.letterNumber,
      method,
      recipient
    });

    res.json({
      success: true,
      data: { result },
      message: `Preapproval letter shared via ${method} successfully`
    });
  } catch (error) {
    logger.error('Error sharing preapproval letter:', error);
    next(error);
  }
};

/**
 * @desc    Regenerate preapproval letter
 * @route   POST /api/v1/preapproval/:id/regenerate
 * @access  Private (Loan Officers, Admins)
 */
exports.regenerate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const letter = await PreapprovalLetter.findById(id)
      .populate('loan')
      .populate('borrower', 'name email phone')
      .populate('loanOfficer', 'name email phone nmls title');

    if (!letter) {
      return next(createError(404, 'Preapproval letter not found'));
    }

    // Authorization: Only assigned LO or admin
    if (
      req.user.role !== 'admin' &&
      letter.loanOfficer._id.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to regenerate this letter'));
    }

    // Generate new PDF with updated data
    const pdfBuffer = await pdfGenerationService.generatePreapprovalLetter(letter.toObject());

    // Delete old PDF from blob
    if (letter.pdfBlobName) {
      try {
        await azureBlobService.deleteFile(letter.pdfBlobName);
      } catch (error) {
        logger.warn('Failed to delete old PDF:', error);
      }
    }

    // Upload new PDF
    const blobName = `preapproval-letters/${letter.loan._id}/${letter.letterNumber}_v${Date.now()}.pdf`;
    const blobUrl = await azureBlobService.uploadFile(
      blobName,
      pdfBuffer,
      'application/pdf'
    );

    // Update letter
    letter.pdfUrl = blobUrl;
    letter.pdfBlobName = blobName;
    await letter.save();

    logger.info('Preapproval letter regenerated', {
      letterId: letter._id,
      letterNumber: letter.letterNumber
    });

    res.json({
      success: true,
      data: { letter },
      message: 'Preapproval letter regenerated successfully'
    });
  } catch (error) {
    logger.error('Error regenerating preapproval letter:', error);
    next(error);
  }
};

/**
 * @desc    Delete preapproval letter
 * @route   DELETE /api/v1/preapproval/:id
 * @access  Private (Loan Officers, Admins)
 */
exports.deletePreapproval = async (req, res, next) => {
  try {
    const { id } = req.params;

    const letter = await PreapprovalLetter.findById(id);
    if (!letter) {
      return next(createError(404, 'Preapproval letter not found'));
    }

    // Authorization: Only assigned LO or admin
    if (
      req.user.role !== 'admin' &&
      letter.loanOfficer.toString() !== req.user.userId
    ) {
      return next(createError(403, 'Not authorized to delete this letter'));
    }

    // Soft delete
    letter.isActive = false;
    await letter.save();

    // Delete PDF from blob
    if (letter.pdfBlobName) {
      try {
        await azureBlobService.deleteFile(letter.pdfBlobName);
      } catch (error) {
        logger.warn('Failed to delete PDF from blob:', error);
      }
    }

    logger.info('Preapproval letter deleted', {
      letterId: letter._id,
      letterNumber: letter.letterNumber
    });

    res.json({
      success: true,
      message: 'Preapproval letter deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting preapproval letter:', error);
    next(error);
  }
};

