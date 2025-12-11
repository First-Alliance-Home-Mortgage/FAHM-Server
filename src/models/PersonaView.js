const mongoose = require('mongoose');

const personaViewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    role: {
      type: String,
      enum: ['borrower', 'loan_officer_tpo', 'loan_officer_retail', 'broker', 'branch_manager', 'realtor', 'admin'],
      required: true,
      index: true
    },
    viewConfiguration: {
      dashboard: {
        layout: {
          type: String,
          enum: ['grid', 'list', 'cards', 'compact'],
          default: 'grid'
        },
        widgets: [{
          widgetId: {
            type: String,
            required: true
          },
          title: String,
          enabled: {
            type: Boolean,
            default: true
          },
          order: Number,
          size: {
            type: String,
            enum: ['small', 'medium', 'large', 'full'],
            default: 'medium'
          },
          refreshInterval: Number, // in seconds
          settings: mongoose.Schema.Types.Mixed
        }],
        defaultFilters: {
          dateRange: String,
          status: [String],
          loanType: [String],
          source: [String]
        }
      },
      navigation: {
        homeView: {
          type: String,
          enum: ['dashboard', 'pipeline', 'loans', 'documents', 'messages'],
          default: 'dashboard'
        },
        pinnedItems: [{
          type: String,
          label: String,
          route: String,
          order: Number
        }],
        hiddenMenuItems: [String]
      },
      notifications: {
        pushEnabled: {
          type: Boolean,
          default: true
        },
        emailEnabled: {
          type: Boolean,
          default: true
        },
        smsEnabled: {
          type: Boolean,
          default: false
        },
        categories: {
          milestones: {
            type: Boolean,
            default: true
          },
          documents: {
            type: Boolean,
            default: true
          },
          messages: {
            type: Boolean,
            default: true
          },
          rates: {
            type: Boolean,
            default: false
          },
          marketing: {
            type: Boolean,
            default: false
          }
        },
        quietHours: {
          enabled: {
            type: Boolean,
            default: false
          },
          startTime: String,
          endTime: String,
          timezone: String
        }
      },
      dataVisibility: {
        // Borrower-specific
        showCreditScore: {
          type: Boolean,
          default: true
        },
        showLoanAmount: {
          type: Boolean,
          default: true
        },
        showInterestRate: {
          type: Boolean,
          default: true
        },
        showDocuments: {
          type: Boolean,
          default: true
        },
        // LO-specific
        showPipeline: {
          type: Boolean,
          default: true
        },
        showPerformanceMetrics: {
          type: Boolean,
          default: true
        },
        showTeamData: {
          type: Boolean,
          default: false
        },
        // Realtor-specific
        showReferralStats: {
          type: Boolean,
          default: true
        },
        showCommissionInfo: {
          type: Boolean,
          default: false
        },
        // BM-specific
        showBranchMetrics: {
          type: Boolean,
          default: true
        },
        showRegionalData: {
          type: Boolean,
          default: false
        }
      },
      preferences: {
        theme: {
          type: String,
          enum: ['light', 'dark', 'auto'],
          default: 'light'
        },
        language: {
          type: String,
          default: 'en'
        },
        dateFormat: {
          type: String,
          default: 'MM/DD/YYYY'
        },
        currencyFormat: {
          type: String,
          default: 'USD'
        },
        timezone: {
          type: String,
          default: 'America/Los_Angeles'
        }
      },
      branding: {
        logo: String,
        primaryColor: String,
        secondaryColor: String,
        partnerName: String,
        partnerLogo: String
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Get default view configuration by role
personaViewSchema.statics.getDefaultConfig = function(role) {
  const configs = {
    borrower: {
      dashboard: {
        layout: 'cards',
        widgets: [
          {
            widgetId: 'loan-status',
            title: 'My Loan Status',
            enabled: true,
            order: 1,
            size: 'large'
          },
          {
            widgetId: 'milestones',
            title: 'Progress Tracker',
            enabled: true,
            order: 2,
            size: 'large'
          },
          {
            widgetId: 'documents',
            title: 'My Documents',
            enabled: true,
            order: 3,
            size: 'medium'
          },
          {
            widgetId: 'messages',
            title: 'Messages',
            enabled: true,
            order: 4,
            size: 'medium'
          },
          {
            widgetId: 'contacts',
            title: 'My Team',
            enabled: true,
            order: 5,
            size: 'small'
          }
        ]
      },
      navigation: {
        homeView: 'dashboard',
        pinnedItems: []
      },
      dataVisibility: {
        showCreditScore: true,
        showLoanAmount: true,
        showInterestRate: true,
        showDocuments: true
      }
    },
    loan_officer_retail: {
      dashboard: {
        layout: 'grid',
        widgets: [
          {
            widgetId: 'pipeline',
            title: 'My Pipeline',
            enabled: true,
            order: 1,
            size: 'large'
          },
          {
            widgetId: 'performance',
            title: 'Performance Metrics',
            enabled: true,
            order: 2,
            size: 'medium'
          },
          {
            widgetId: 'pending-actions',
            title: 'Pending Actions',
            enabled: true,
            order: 3,
            size: 'medium'
          },
          {
            widgetId: 'rate-sheet',
            title: 'Today\'s Rates',
            enabled: true,
            order: 4,
            size: 'small'
          }
        ]
      },
      navigation: {
        homeView: 'pipeline',
        pinnedItems: []
      },
      dataVisibility: {
        showPipeline: true,
        showPerformanceMetrics: true,
        showTeamData: false
      }
    },
    realtor: {
      dashboard: {
        layout: 'cards',
        widgets: [
          {
            widgetId: 'referrals',
            title: 'My Referrals',
            enabled: true,
            order: 1,
            size: 'large'
          },
          {
            widgetId: 'active-loans',
            title: 'Active Loans',
            enabled: true,
            order: 2,
            size: 'medium'
          },
          {
            widgetId: 'referral-stats',
            title: 'Referral Performance',
            enabled: true,
            order: 3,
            size: 'medium'
          }
        ]
      },
      navigation: {
        homeView: 'dashboard',
        pinnedItems: []
      },
      dataVisibility: {
        showReferralStats: true,
        showCommissionInfo: false
      }
    },
    branch_manager: {
      dashboard: {
        layout: 'grid',
        widgets: [
          {
            widgetId: 'branch-performance',
            title: 'Branch Performance',
            enabled: true,
            order: 1,
            size: 'large'
          },
          {
            widgetId: 'team-pipeline',
            title: 'Team Pipeline',
            enabled: true,
            order: 2,
            size: 'large'
          },
          {
            widgetId: 'leaderboard',
            title: 'Leaderboard',
            enabled: true,
            order: 3,
            size: 'medium'
          }
        ]
      },
      navigation: {
        homeView: 'dashboard',
        pinnedItems: []
      },
      dataVisibility: {
        showBranchMetrics: true,
        showRegionalData: false,
        showTeamData: true
      }
    }
  };

  return configs[role] || configs.borrower;
};

// Create or update persona view
personaViewSchema.statics.createOrUpdate = async function(userId, role, config) {
  const existing = await this.findOne({ user: userId });
  
  if (existing) {
    existing.viewConfiguration = { ...existing.viewConfiguration, ...config };
    existing.lastUpdated = new Date();
    await existing.save();
    return existing;
  }

  const defaultConfig = this.getDefaultConfig(role);
  const personaView = await this.create({
    user: userId,
    role,
    viewConfiguration: { ...defaultConfig, ...config }
  });

  return personaView;
};

const PersonaView = mongoose.model('PersonaView', personaViewSchema);

module.exports = PersonaView;
