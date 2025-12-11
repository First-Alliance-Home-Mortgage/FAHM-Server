const mongoose = require('mongoose');
const crypto = require('crypto');

const tradelineSchema = new mongoose.Schema({
  creditorName: String,
  accountNumber: String, // Last 4 digits only
  accountType: {
    type: String,
    enum: ['revolving', 'installment', 'mortgage', 'auto', 'student', 'other']
  },
  balance: Number,
  creditLimit: Number,
  monthlyPayment: Number,
  paymentStatus: {
    type: String,
    enum: ['current', 'past_due', 'charge_off', 'collection', 'closed']
  },
  openDate: Date,
  lastPaymentDate: Date,
  remarks: String
});

const creditScoreSchema = new mongoose.Schema({
  bureau: {
    type: String,
    enum: ['equifax', 'experian', 'transunion'],
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  scoreModel: String,
  factors: [String]
});

const creditReportSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      index: true
    },
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    xactusReportId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    reportType: {
      type: String,
      enum: ['tri_merge', 'single_bureau', 'soft_pull'],
      default: 'tri_merge'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'expired'],
      default: 'pending',
      index: true
    },
    scores: [creditScoreSchema],
    midScore: Number, // Middle score of the three bureaus
    tradelines: [tradelineSchema],
    publicRecords: [{
      type: {
        type: String,
        enum: ['bankruptcy', 'tax_lien', 'judgment', 'foreclosure']
      },
      filingDate: Date,
      amount: Number,
      status: String,
      remarks: String
    }],
    inquiries: [{
      bureau: String,
      creditorName: String,
      inquiryDate: Date,
      inquiryType: String
    }],
    summary: {
      totalAccounts: Number,
      openAccounts: Number,
      closedAccounts: Number,
      totalDebt: Number,
      availableCredit: Number,
      creditUtilization: Number,
      oldestAccount: Date,
      recentInquiries: Number
    },
    // Encrypted fields
    encryptedData: {
      type: String,
      select: false // Never return in queries by default
    },
    encryptionIV: {
      type: String,
      select: false
    },
    // FCRA retention tracking
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    retentionPeriodDays: {
      type: Number,
      default: 730 // 2 years per FCRA
    },
    errorMessage: String,
    rawDataStored: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Index for FCRA retention cleanup
creditReportSchema.index({ expiresAt: 1, status: 1 });

// Compound index for loan officer queries
creditReportSchema.index({ loan: 1, createdAt: -1 });
creditReportSchema.index({ borrower: 1, createdAt: -1 });

/**
 * Encrypt sensitive credit data before storing
 */
creditReportSchema.methods.encryptSensitiveData = function(rawData) {
  const encryptionKey = process.env.CREDIT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  const key = Buffer.from(encryptionKey.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(rawData), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  this.encryptedData = encrypted;
  this.encryptionIV = iv.toString('hex');
  this.rawDataStored = true;
};

/**
 * Decrypt sensitive credit data
 */
creditReportSchema.methods.decryptSensitiveData = function() {
  if (!this.encryptedData || !this.encryptionIV) {
    return null;
  }
  
  const encryptionKey = process.env.CREDIT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  const key = Buffer.from(encryptionKey.slice(0, 64), 'hex');
  const iv = Buffer.from(this.encryptionIV, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(this.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};

/**
 * Calculate mid score from three bureau scores
 */
creditReportSchema.methods.calculateMidScore = function() {
  if (this.scores.length !== 3) {
    return null;
  }
  
  const sortedScores = this.scores.map(s => s.score).sort((a, b) => a - b);
  this.midScore = sortedScores[1]; // Middle value
  return this.midScore;
};

/**
 * Pre-save hook to set expiration date
 */
creditReportSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + this.retentionPeriodDays);
    this.expiresAt = expirationDate;
  }
  next();
});

module.exports = mongoose.model('CreditReport', creditReportSchema);
