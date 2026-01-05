const createError = require('http-errors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const azureBlobService = require('../services/azureBlobService');
const User = require('../models/User');
const logger = require('../utils/logger');
// Removed unused variables: validationResult and ALLOWED_MIME_TYPES

/**
 * Upload profile picture for the current user
 * POST /api/v1/users/profile-picture
 */
exports.uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError(400, 'No file uploaded'));
    }
    const { mimetype, originalname, buffer, size } = req.file;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(mimetype)) {
      return next(createError(400, 'Only PNG and JPG images are allowed'));
    }
    if (size > MAX_FILE_SIZE) {
      return next(createError(400, 'File exceeds 10MB limit'));
    }
    const ext = path.extname(originalname).toLowerCase();
    const uniqueFileName = `profile-pictures/${req.user._id}/${uuidv4()}${ext}`;
    const uploadResult = await azureBlobService.uploadFile(uniqueFileName, buffer, mimetype, {
      userId: req.user._id.toString(),
      type: 'profile-picture',
    });
    // Update user profile picture URL
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { photo: uploadResult.blobUrl },
      { new: true }
    );
    logger.info('Profile picture uploaded', {
      userId: req.user._id,
      photoUrl: uploadResult.blobUrl,
    });
    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      photoUrl: uploadResult.blobUrl,
      user: { _id: user._id, photo: user.photo, name: user.name, email: user.email },
    });
  } catch (error) {
    logger.error('Error uploading profile picture:', error);
    next(error);
  }
};
