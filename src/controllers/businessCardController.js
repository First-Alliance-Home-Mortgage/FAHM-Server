const createError = require('http-errors');
const { validationResult } = require('express-validator');
const QRCode = require('qrcode');
const BusinessCard = require('../models/BusinessCard');
const User = require('../models/User');
const ReferralSource = require('../models/ReferralSource');
const logger = require('../utils/logger');
const escapeRegex = require('../utils/escapeRegex');

/**
 * Create or update business card for authenticated user
 * POST /api/v1/business-cards
 */
exports.createOrUpdate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const userId = req.user._id;
    const {
      nmls,
      title,
      photo,
      bio,
      phone,
      email,
      branch,
      socialLinks,
      branding,
      referralSourceId,
      isActive,
      isPublic,
      customDomain
    } = req.body;

    // Get user data for auto-generation
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, 'User not found'));
    }

    // Fetch referral source branding if provided
    let referralBranding = null;
    if (referralSourceId) {
      const referralSource = await ReferralSource.findById(referralSourceId);
      if (referralSource && 
          referralSource.status === 'active' && 
          referralSource.isCoBrandingEnabled('business_card')) {
        referralBranding = referralSource.getBrandingConfig();
      }
    }

    // Generate slug from user name
    const slug = BusinessCard.generateSlug(user.name);

    // Check for existing card
    let card = await BusinessCard.findOne({ user: userId });

    // Generate card URL
    const baseUrl = process.env.BUSINESS_CARD_URL || 'https://card.fahm.com';
    const cardUrl = customDomain || `${baseUrl}/${slug}`;

    // Generate Apply Now URL with pre-fill
    const posBaseUrl = process.env.POS_API_URL || 'https://apply.fahm.com';
    const applyNowUrl = `${posBaseUrl}/application/start?lo_id=${userId}&source=business_card`;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(cardUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1
    });

    const cardData = {
      user: userId,
      slug,
      nmls: nmls || user.nmls || '',
      title: title || user.title || 'Loan Officer',
      photo: photo || user.photo || '',
      bio: bio || '',
      phone: phone || user.phone || '',
      email: email || user.email,
      branch: branch || {
        name: user.branch?.name || 'FAHM Branch',
        address: user.branch?.address || '',
        city: user.branch?.city || '',
        state: user.branch?.state || '',
        zip: user.branch?.zip || '',
        phone: user.branch?.phone || ''
      },
      socialLinks: socialLinks || {},
      branding: referralBranding ? {
        primaryColor: referralBranding.primaryColor || '#003B5C',
        secondaryColor: referralBranding.secondaryColor || '#FF6B35',
        logo: 'https://fahm.com/logo.png',
        partnerLogo: referralBranding.logo,
        partnerName: referralBranding.name || referralBranding.companyName
      } : (branding || {}),
      referralSource: referralSourceId || null,
      qrCode,
      applyNowUrl,
      isActive: isActive !== undefined ? isActive : true,
      isPublic: isPublic !== undefined ? isPublic : true,
      customDomain: customDomain || null
    };

    if (card) {
      // Update existing card
      Object.assign(card, cardData);
      await card.save();
      
      logger.info('Business card updated', {
        userId,
        cardId: card._id,
        slug
      });
    } else {
      // Create new card
      card = new BusinessCard(cardData);
      await card.save();
      
      logger.info('Business card created', {
        userId,
        cardId: card._id,
        slug
      });
    }

    return res.json({
      success: true,
      data: {
        card,
        url: cardUrl,
        qrCodeUrl: qrCode
      }
    });
  } catch (error) {
    logger.error('Error creating/updating business card:', error);
    next(error);
  }
};

/**
 * Get business card by slug (public access)
 * GET /api/v1/business-cards/slug/:slug
 */
exports.getBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const card = await BusinessCard.findOne({ slug, isActive: true })
      .populate('user', 'name email phone role');

    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    if (!card.isPublic && (!req.user || req.user._id.toString() !== card.user._id.toString())) {
      return next(createError(403, 'This business card is private'));
    }

    // Increment view counter (async, don't wait)
    card.incrementViews().catch(err => logger.error('Failed to increment views:', err));

    logger.info('Business card viewed', {
      cardId: card._id,
      slug,
      viewerId: req.user?._id
    });

    return res.json({
      success: true,
      data: card
    });
  } catch (error) {
    logger.error('Error fetching business card:', error);
    next(error);
  }
};

/**
 * Get current user's business card
 * GET /api/v1/business-cards/me
 */
exports.getMyCard = async (req, res, next) => {
  try {
    const card = await BusinessCard.findOne({ user: req.user._id })
      .populate('user', 'name email phone role nmls');

    if (!card) {
      return next(createError(404, 'Business card not found. Please create one first.'));
    }

    logger.info('User retrieved own business card', {
      userId: req.user._id,
      cardId: card._id
    });

    return res.json({
      success: true,
      data: card
    });
  } catch (error) {
    logger.error('Error fetching user business card:', error);
    next(error);
  }
};

/**
 * Track Apply Now click
 * POST /api/v1/business-cards/slug/:slug/apply
 */
exports.trackApply = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const card = await BusinessCard.findOne({ slug, isActive: true });
    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    // Increment apply counter
    await card.incrementApplies();

    logger.info('Apply Now tracked', {
      cardId: card._id,
      slug,
      userId: req.user?._id
    });

    return res.json({
      success: true,
      data: {
        applyNowUrl: card.applyNowUrl
      }
    });
  } catch (error) {
    logger.error('Error tracking apply:', error);
    next(error);
  }
};

/**
 * Track share action
 * POST /api/v1/business-cards/slug/:slug/share
 */
exports.trackShare = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { method } = req.body; // email, sms, social, qr

    const card = await BusinessCard.findOne({ slug, isActive: true });
    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    // Increment share counter
    await card.incrementShares();

    logger.info('Share tracked', {
      cardId: card._id,
      slug,
      method,
      userId: req.user?._id
    });

    return res.json({
      success: true,
      message: 'Share tracked successfully'
    });
  } catch (error) {
    logger.error('Error tracking share:', error);
    next(error);
  }
};

/**
 * Get business card analytics
 * GET /api/v1/business-cards/me/analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const card = await BusinessCard.findOne({ user: req.user._id });
    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    const analytics = {
      views: card.stats.views,
      applies: card.stats.applies,
      shares: card.stats.shares,
      conversionRate: card.stats.views > 0 
        ? ((card.stats.applies / card.stats.views) * 100).toFixed(2) 
        : 0
    };

    logger.info('Analytics retrieved', {
      userId: req.user._id,
      cardId: card._id
    });

    return res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    next(error);
  }
};

/**
 * Delete business card
 * DELETE /api/v1/business-cards/me
 */
exports.deleteCard = async (req, res, next) => {
  try {
    const card = await BusinessCard.findOne({ user: req.user._id });
    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    await BusinessCard.deleteOne({ _id: card._id });

    logger.info('Business card deleted', {
      userId: req.user._id,
      cardId: card._id
    });

    return res.json({
      success: true,
      message: 'Business card deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting business card:', error);
    next(error);
  }
};

/**
 * Regenerate QR code
 * POST /api/v1/business-cards/me/regenerate-qr
 */
exports.regenerateQR = async (req, res, next) => {
  try {
    const card = await BusinessCard.findOne({ user: req.user._id });
    if (!card) {
      return next(createError(404, 'Business card not found'));
    }

    const baseUrl = process.env.BUSINESS_CARD_URL || 'https://card.fahm.com';
    const cardUrl = card.customDomain || `${baseUrl}/${card.slug}`;

    const qrCode = await QRCode.toDataURL(cardUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1
    });

    card.qrCode = qrCode;
    await card.save();

    logger.info('QR code regenerated', {
      userId: req.user._id,
      cardId: card._id
    });

    return res.json({
      success: true,
      data: {
        qrCode
      }
    });
  } catch (error) {
    logger.error('Error regenerating QR code:', error);
    next(error);
  }
};

/**
 * List all business cards (Admin/BM only)
 * GET /api/v1/business-cards
 */
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const filter = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { slug: new RegExp(safeSearch, 'i') },
        { email: new RegExp(safeSearch, 'i') },
        { nmls: new RegExp(safeSearch, 'i') }
      ];
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const cards = await BusinessCard.find(filter)
      .populate('user', 'name email role')
      .sort({ 'stats.views': -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await BusinessCard.countDocuments(filter);

    logger.info('Business cards listed', {
      userId: req.user._id,
      count: cards.length,
      total
    });

    return res.json({
      success: true,
      data: cards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error listing business cards:', error);
    next(error);
  }
};

module.exports = exports;
