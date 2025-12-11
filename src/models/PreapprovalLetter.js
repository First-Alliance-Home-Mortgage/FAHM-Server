const mongoose = require('mongoose');

const preapprovalLetterSchema = new mongoose.Schema(
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
    loanOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    letterNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    borrowerData: {
      primaryBorrower: {
        name: { type: String, required: true },
        email: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        zip: String
      },
      coBorrower: {
        name: String,
        email: String,
        phone: String
      }
    },
    loanData: {
      loanAmount: {
        type: Number,
        required: true
      },
      purchasePrice: Number,
      downPayment: Number,
      propertyAddress: String,
      propertyCity: String,
      propertyState: String,
      propertyZip: String,
      propertyType: {
        type: String,
        enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured'],
        default: 'single_family'
      },
      loanType: {
        type: String,
        enum: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
        default: 'conventional'
      },
      interestRate: Number,
      loanTerm: Number,
      monthlyPayment: Number,
      estimatedClosingDate: Date
    },
    creditData: {
      creditScore: Number,
      hasVerifiedIncome: {
        type: Boolean,
        default: false
      },
      hasVerifiedAssets: {
        type: Boolean,
        default: false
      }
    },
    referralSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralSource'
    },
    branding: {
      logo: {
        type: String,
        default: 'https://fahm.com/logo.png'
      },
      partnerLogo: String,
      partnerName: String,
      primaryColor: {
        type: String,
        default: '#003B5C'
      },
      secondaryColor: {
        type: String,
        default: '#FF6B35'
      }
    },
    pdfUrl: {
      type: String,
      required: false
    },
    pdfBlobName: {
      type: String,
      required: false
    },
    status: {
      type: String,
      enum: ['draft', 'generated', 'sent', 'viewed', 'expired'],
      default: 'draft',
      index: true
    },
    encompassData: {
      encompassLoanId: String,
      lastSync: Date,
      syncStatus: {
        type: String,
        enum: ['pending', 'synced', 'failed']
      }
    },
    expirationDate: {
      type: Date,
      required: true,
      index: true
    },
    validityDays: {
      type: Number,
      default: 90
    },
    conditions: [{
      description: String,
      required: Boolean
    }],
    disclaimers: [{
      text: String,
      order: Number
    }],
    signatures: {
      loanOfficerName: String,
      loanOfficerTitle: String,
      loanOfficerNMLS: String,
      loanOfficerSignature: String,
      signedDate: Date,
      companyName: {
        type: String,
        default: 'First Alliance Home Mortgage'
      },
      companyNMLS: {
        type: String,
        default: 'NMLS #00000'
      }
    },
    sharing: {
      sharedViaEmail: {
        type: Boolean,
        default: false
      },
      sharedViaSMS: {
        type: Boolean,
        default: false
      },
      sharedInApp: {
        type: Boolean,
        default: false
      },
      shareHistory: [{
        method: {
          type: String,
          enum: ['email', 'sms', 'download', 'link']
        },
        recipient: String,
        sharedAt: Date,
        sharedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }]
    },
    viewHistory: [{
      viewedBy: String,
      viewedAt: Date,
      ipAddress: String
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for expiration cleanup
preapprovalLetterSchema.index({ expirationDate: 1, status: 1 });

// Generate unique letter number
preapprovalLetterSchema.statics.generateLetterNumber = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `PA-${year}-${String(count + 1).padStart(6, '0')}`;
};

// Mark as sent
preapprovalLetterSchema.methods.markSent = async function(method, recipient, sharedBy) {
  this.status = 'sent';
  
  if (method === 'email') {
    this.sharing.sharedViaEmail = true;
  } else if (method === 'sms') {
    this.sharing.sharedViaSMS = true;
  } else if (method === 'download') {
    this.sharing.sharedInApp = true;
  }
  
  this.sharing.shareHistory.push({
    method,
    recipient,
    sharedAt: new Date(),
    sharedBy
  });
  
  await this.save();
};

// Track view
preapprovalLetterSchema.methods.trackView = async function(viewedBy, ipAddress) {
  if (this.status === 'sent') {
    this.status = 'viewed';
  }
  
  this.viewHistory.push({
    viewedBy,
    viewedAt: new Date(),
    ipAddress
  });
  
  await this.save();
};

// Check if expired
preapprovalLetterSchema.methods.isExpired = function() {
  return new Date() > this.expirationDate;
};

const PreapprovalLetter = mongoose.model('PreapprovalLetter', preapprovalLetterSchema);

module.exports = PreapprovalLetter;
