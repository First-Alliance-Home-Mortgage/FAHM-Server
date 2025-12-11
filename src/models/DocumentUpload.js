const mongoose = require('mongoose');

const documentUploadSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    originalFileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    },
    documentType: {
      type: String,
      required: true,
      enum: [
        'paystub',
        'w2',
        'tax_return',
        'bank_statement',
        'id',
        'proof_of_employment',
        'appraisal',
        'purchase_agreement',
        'insurance',
        'credit_report',
        'other'
      ]
    },
    description: {
      type: String,
      trim: true
    },
    blobUrl: {
      type: String,
      required: true
    },
    blobContainer: {
      type: String,
      required: true,
      default: 'loan-documents'
    },
    blobName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'synced', 'failed', 'deleted'],
      default: 'uploaded',
      index: true
    },
    posSystem: {
      type: String,
      enum: ['blend', 'big_pos', 'encompass'],
      required: false
    },
    posDocumentId: {
      type: String,
      required: false
    },
    posSyncedAt: {
      type: Date,
      required: false
    },
    encompassDocId: {
      type: String,
      required: false
    },
    encompassSyncedAt: {
      type: Date,
      required: false
    },
    validationErrors: [{
      field: String,
      message: String
    }],
    metadata: {
      uploadSource: {
        type: String,
        enum: ['mobile_app', 'web_portal', 'email', 'api'],
        default: 'mobile_app'
      },
      ipAddress: String,
      userAgent: String,
      pageCount: Number,
      isComplete: {
        type: Boolean,
        default: false
      },
      completedAt: Date
    },
    notifications: {
      loNotified: {
        type: Boolean,
        default: false
      },
      loNotifiedAt: Date,
      processorNotified: {
        type: Boolean,
        default: false
      },
      processorNotifiedAt: Date
    },
    expiresAt: {
      type: Date,
      required: false
    },
    deletedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
documentUploadSchema.index({ loan: 1, status: 1 });
documentUploadSchema.index({ uploadedBy: 1, createdAt: -1 });
documentUploadSchema.index({ status: 1, createdAt: -1 });
documentUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark document as synced to POS
documentUploadSchema.methods.markSyncedToPOS = async function(posSystem, posDocumentId) {
  this.status = 'synced';
  this.posSystem = posSystem;
  this.posDocumentId = posDocumentId;
  this.posSyncedAt = new Date();
  await this.save();
};

// Mark document as synced to Encompass
documentUploadSchema.methods.markSyncedToEncompass = async function(encompassDocId) {
  this.status = 'synced';
  this.encompassDocId = encompassDocId;
  this.encompassSyncedAt = new Date();
  await this.save();
};

// Mark LO as notified
documentUploadSchema.methods.notifyLO = async function() {
  this.notifications.loNotified = true;
  this.notifications.loNotifiedAt = new Date();
  await this.save();
};

// Mark processor as notified
documentUploadSchema.methods.notifyProcessor = async function() {
  this.notifications.processorNotified = true;
  this.notifications.processorNotifiedAt = new Date();
  await this.save();
};

// Mark as failed
documentUploadSchema.methods.markFailed = async function(errors) {
  this.status = 'failed';
  this.validationErrors = errors;
  await this.save();
};

const DocumentUpload = mongoose.model('DocumentUpload', documentUploadSchema);

module.exports = DocumentUpload;
