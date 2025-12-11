const mongoose = require('mongoose');

const businessCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    nmls: {
      type: String,
      required: false,
      trim: true
    },
    title: {
      type: String,
      required: false,
      trim: true
    },
    photo: {
      type: String,
      required: false
    },
    bio: {
      type: String,
      maxlength: 500
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    branch: {
      name: String,
      address: String,
      city: String,
      state: String,
      zip: String,
      phone: String
    },
    socialLinks: {
      linkedin: String,
      facebook: String,
      twitter: String,
      instagram: String
    },
    referralSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralSource'
    },
    branding: {
      primaryColor: {
        type: String,
        default: '#003B5C' // FAHM blue
      },
      secondaryColor: {
        type: String,
        default: '#FF6B35' // FAHM orange
      },
      logo: {
        type: String,
        default: 'https://fahm.com/logo.png'
      },
      partnerLogo: {
        type: String,
        required: false
      },
      partnerName: {
        type: String,
        required: false
      }
    },
    qrCode: {
      type: String,
      required: false
    },
    applyNowUrl: {
      type: String,
      required: false
    },
    stats: {
      views: {
        type: Number,
        default: 0
      },
      applies: {
        type: Number,
        default: 0
      },
      shares: {
        type: Number,
        default: 0
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    customDomain: {
      type: String,
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Index for slug lookups
businessCardSchema.index({ slug: 1, isActive: 1 });

// Generate slug from user name
businessCardSchema.statics.generateSlug = function(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Increment view counter
businessCardSchema.methods.incrementViews = async function() {
  this.stats.views += 1;
  await this.save();
};

// Increment apply counter
businessCardSchema.methods.incrementApplies = async function() {
  this.stats.applies += 1;
  await this.save();
};

// Increment share counter
businessCardSchema.methods.incrementShares = async function() {
  this.stats.shares += 1;
  await this.save();
};

const BusinessCard = mongoose.model('BusinessCard', businessCardSchema);

module.exports = BusinessCard;
