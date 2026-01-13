const multer = require('multer');
const path = require('path');
// ...existing code...

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Validate MIME type first (keep legacy behavior for tests),
  // but allow missing or 'application/octet-stream' to pass to extension check
  if (
    file.mimetype &&
    file.mimetype !== 'application/octet-stream' &&
    !ALLOWED_MIME_TYPES.includes(file.mimetype)
  ) {
    return cb(
      new Error(`Invalid file type. Only PDF, PNG, and JPG files are allowed. Received: ${file.mimetype}`),
      false
    );
  }

  // Then check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
  if (!allowedExtensions.includes(ext)) {
    return cb(
      new Error(`Invalid file extension. Only .pdf, .png, .jpg, and .jpeg files are allowed. Received: ${ext}`),
      false
    );
  }

  cb(null, true);
};

// Configure upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Max 5 files per request
  }
});

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 5 files per upload'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field in upload'
      });
    }
  }
  
  if (err.message) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next(err);
};

module.exports = {
  upload,
  handleMulterError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  fileFilter,
};
