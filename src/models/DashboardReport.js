const mongoose = require('mongoose');

const dashboardReportSchema = new mongoose.Schema(
  {
    reportName: {
      type: String,
      required: true
    },
    reportType: {
      type: String,
      enum: ['pipeline', 'production', 'conversion', 'performance', 'branch_summary', 'regional_summary'],
      required: true,
      index: true
    },
    powerBIReportId: {
      type: String,
      unique: true,
      sparse: true
    },
    powerBIDatasetId: {
      type: String
    },
    powerBIWorkspaceId: {
      type: String
    },
    // Access control
    accessLevel: {
      type: String,
      enum: ['personal', 'branch', 'regional', 'company'],
      required: true,
      default: 'personal'
    },
    allowedRoles: [{
      type: String,
      enum: ['borrower', 'loan_officer_tpo', 'loan_officer_retail', 'broker', 'branch_manager', 'realtor', 'admin']
    }],
    // Report configuration
    defaultFilters: {
      dateRange: String,
      productTypes: [String],
      loanSources: [String]
    },
    refreshSchedule: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    lastRefreshed: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    description: String,
    thumbnailUrl: String,
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for report access
dashboardReportSchema.index({ reportType: 1, accessLevel: 1, isActive: 1 });
dashboardReportSchema.index({ allowedRoles: 1, isActive: 1 });

module.exports = mongoose.model('DashboardReport', dashboardReportSchema);
