const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system', 'function'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  functionCall: {
    name: String,
    arguments: String
  },
  functionResponse: {
    name: String,
    content: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const dataSourceSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['encompass', 'crm', 'pos', 'faq', 'calculator', 'rates', 'guidelines'],
    required: true
  },
  query: String,
  response: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const chatbotSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanApplication'
  },
  status: {
    type: String,
    enum: ['active', 'escalated', 'resolved', 'closed'],
    default: 'active',
    index: true
  },
  messages: [messageSchema],
  context: {
    userRole: String,
    currentLoanId: String,
    recentTopics: [String],
    preferredLanguage: {
      type: String,
      default: 'en'
    }
  },
  escalation: {
    escalated: {
      type: Boolean,
      default: false
    },
    escalatedAt: Date,
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalationReason: String,
    escalationType: {
      type: String,
      enum: ['teams', 'in_app_chat', 'sms', 'email']
    },
    resolvedAt: Date,
    resolutionNotes: String
  },
  dataSources: [dataSourceSchema],
  metadata: {
    deviceType: String,
    ipAddress: String,
    userAgent: String,
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    endedAt: Date,
    sessionDuration: Number,
    messageCount: {
      type: Number,
      default: 0
    },
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedbackText: String
  },
  settings: {
    voiceEnabled: {
      type: Boolean,
      default: false
    },
    autoEscalate: {
      type: Boolean,
      default: false
    },
    maxIdleMinutes: {
      type: Number,
      default: 30
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
chatbotSessionSchema.index({ user: 1, status: 1 });
chatbotSessionSchema.index({ 'metadata.startedAt': 1 });
chatbotSessionSchema.index({ 'metadata.lastMessageAt': 1 });
chatbotSessionSchema.index({ 'escalation.escalated': 1, status: 1 });

// TTL index - auto-delete closed sessions after 90 days
chatbotSessionSchema.index(
  { 'metadata.endedAt': 1 },
  { 
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: { status: 'closed' }
  }
);

// Instance methods
chatbotSessionSchema.methods.addMessage = function(role, content, functionCall = null, functionResponse = null) {
  this.messages.push({
    role,
    content,
    functionCall,
    functionResponse,
    timestamp: new Date()
  });
  this.metadata.lastMessageAt = new Date();
  this.metadata.messageCount += 1;
};

chatbotSessionSchema.methods.addDataSource = function(source, query, response) {
  this.dataSources.push({
    source,
    query,
    response,
    timestamp: new Date()
  });
};

chatbotSessionSchema.methods.escalateToHuman = function(escalationType, escalatedTo, reason) {
  this.status = 'escalated';
  this.escalation.escalated = true;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalationType = escalationType;
  this.escalation.escalatedTo = escalatedTo;
  this.escalation.escalationReason = reason;
};

chatbotSessionSchema.methods.resolveEscalation = function(resolutionNotes) {
  this.status = 'resolved';
  this.escalation.resolvedAt = new Date();
  this.escalation.resolutionNotes = resolutionNotes;
};

chatbotSessionSchema.methods.closeSession = function(satisfactionRating = null, feedbackText = null) {
  this.status = 'closed';
  this.metadata.endedAt = new Date();
  this.metadata.sessionDuration = Math.floor((this.metadata.endedAt - this.metadata.startedAt) / 1000); // seconds
  if (satisfactionRating) {
    this.metadata.satisfactionRating = satisfactionRating;
  }
  if (feedbackText) {
    this.metadata.feedbackText = feedbackText;
  }
};

chatbotSessionSchema.methods.isExpired = function() {
  if (this.status === 'closed') return true;
  const idleMinutes = (Date.now() - this.metadata.lastMessageAt) / 1000 / 60;
  return idleMinutes > this.settings.maxIdleMinutes;
};

chatbotSessionSchema.methods.getRecentMessages = function(count = 10) {
  return this.messages.slice(-count);
};

// Static methods
chatbotSessionSchema.statics.generateSessionId = function() {
  return `chatbot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

chatbotSessionSchema.statics.findActiveSessions = function(userId) {
  return this.find({
    user: userId,
    status: { $in: ['active', 'escalated'] }
  }).sort({ 'metadata.lastMessageAt': -1 });
};

chatbotSessionSchema.statics.findEscalatedSessions = function() {
  return this.find({
    'escalation.escalated': true,
    status: 'escalated'
  }).populate('user', 'name email phone')
    .populate('escalation.escalatedTo', 'name email')
    .sort({ 'escalation.escalatedAt': -1 });
};

chatbotSessionSchema.statics.getSessionStats = function(filters = {}) {
  const matchStage = { ...filters };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        activeSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        escalatedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] }
        },
        resolvedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        closedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
        },
        avgMessageCount: { $avg: '$metadata.messageCount' },
        avgSessionDuration: { $avg: '$metadata.sessionDuration' },
        avgSatisfactionRating: { $avg: '$metadata.satisfactionRating' },
        escalationRate: {
          $avg: { $cond: ['$escalation.escalated', 1, 0] }
        }
      }
    }
  ]);
};

chatbotSessionSchema.statics.closeIdleSessions = async function() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  const idleSessions = await this.find({
    status: { $in: ['active', 'escalated'] },
    'metadata.lastMessageAt': { $lt: thirtyMinutesAgo }
  });

  let closedCount = 0;
  for (const session of idleSessions) {
    session.closeSession();
    await session.save();
    closedCount++;
  }

  return closedCount;
};

const ChatbotSession = mongoose.model('ChatbotSession', chatbotSessionSchema);

module.exports = ChatbotSession;
