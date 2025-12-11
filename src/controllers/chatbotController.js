const createError = require('http-errors');
const { validationResult } = require('express-validator');
const ChatbotSession = require('../models/ChatbotSession');
const azureOpenAIService = require('../services/azureOpenAIService');
const chatbotKnowledgeService = require('../services/chatbotKnowledgeService');
const smsNotificationService = require('../services/smsNotificationService');
const logger = require('../utils/logger');
const User = require('../models/User');

/**
 * Start a new chatbot conversation session
 * @route POST /api/v1/chatbot/start
 */
exports.startSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId, initialMessage, deviceType, voiceEnabled } = req.body;

    // Create new session
    const sessionId = ChatbotSession.generateSessionId();
    const session = new ChatbotSession({
      sessionId,
      user: req.user._id,
      loan: loanId || null,
      status: 'active',
      context: {
        userRole: req.user.role,
        currentLoanId: loanId || null,
        recentTopics: [],
        preferredLanguage: req.user.preferredLanguage || 'en'
      },
      metadata: {
        deviceType: deviceType || 'unknown',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      },
      settings: {
        voiceEnabled: voiceEnabled || false
      }
    });

    // Build system prompt
    const systemPrompt = azureOpenAIService.buildSystemPrompt(session.context);
    session.addMessage('system', systemPrompt);

    // Process initial message if provided
    if (initialMessage) {
      session.addMessage('user', initialMessage);

      try {
        // Get AI response
        const messages = azureOpenAIService.formatConversationHistory(session.messages);
        const functions = azureOpenAIService.getFunctionDefinitions();

        const completion = await azureOpenAIService.getChatCompletion(messages, functions);
        const aiMessage = completion.choices[0].message;

        // Handle function call if present
        if (aiMessage.function_call) {
          const functionName = aiMessage.function_call.name;
          const functionArgs = JSON.parse(aiMessage.function_call.arguments);

          // Log function call
          session.addMessage('assistant', aiMessage.content || '', aiMessage.function_call);

          // Execute function
          const functionResult = await chatbotKnowledgeService.executeFunction(functionName, functionArgs);
          session.addDataSource(functionName, JSON.stringify(functionArgs), JSON.stringify(functionResult));

          // Add function response
          session.addMessage('function', JSON.stringify(functionResult), null, {
            name: functionName,
            content: JSON.stringify(functionResult)
          });

          // Get final AI response with function result
          const messagesWithFunction = azureOpenAIService.formatConversationHistory(session.messages);
          const finalCompletion = await azureOpenAIService.getChatCompletion(messagesWithFunction, functions);
          const finalMessage = finalCompletion.choices[0].message;

          session.addMessage('assistant', finalMessage.content);
        } else {
          // No function call, just add AI response
          session.addMessage('assistant', aiMessage.content);
        }
      } catch (error) {
        logger.error('AI response error:', error);
        // Fallback response
        const fallbackResponse = azureOpenAIService.generateFallbackResponse(initialMessage);
        session.addMessage('assistant', fallbackResponse);
      }
    } else {
      // Welcome message
      const welcomeMessage = `Hello! I'm your FAHM AI Assistant. I can help you with:

• Checking your loan status and milestones
• Answering questions about mortgage programs and rates
• Calculating mortgage payments
• Finding information about documents and processes
• Connecting you with your loan officer

How can I assist you today?`;
      session.addMessage('assistant', welcomeMessage);
    }

    await session.save();

    res.status(201).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        messages: session.messages.slice(-2).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
      }
    });
  } catch (error) {
    logger.error('Start chatbot session error:', error);
    next(error);
  }
};

/**
 * Send a message in an existing chatbot session
 * @route POST /api/v1/chatbot/message
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { sessionId, message } = req.body;

    // Find session
    const session = await ChatbotSession.findOne({ sessionId, user: req.user._id });
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Check if session expired
    if (session.isExpired()) {
      session.closeSession();
      await session.save();
      return next(createError(410, 'Session expired'));
    }

    // Check if session is closed
    if (session.status === 'closed') {
      return next(createError(400, 'Session is closed'));
    }

    // Add user message
    session.addMessage('user', message);

    try {
      // Get AI response
      const messages = azureOpenAIService.formatConversationHistory(session.messages);
      const functions = azureOpenAIService.getFunctionDefinitions();

      const completion = await azureOpenAIService.getChatCompletion(messages, functions);
      const aiMessage = completion.choices[0].message;

      // Handle function call if present
      if (aiMessage.function_call) {
        const functionName = aiMessage.function_call.name;
        const functionArgs = JSON.parse(aiMessage.function_call.arguments);

        // Log function call
        session.addMessage('assistant', aiMessage.content || '', aiMessage.function_call);

        // Special handling for escalateToHuman
        if (functionName === 'escalateToHuman') {
          const escalationData = await chatbotKnowledgeService.executeFunction(functionName, functionArgs);
          
          // Find available loan officer
          let assignedOfficer = null;
          if (session.loan) {
            const LoanApplication = require('../models/LoanApplication');
            const loan = await LoanApplication.findById(session.loan).populate('assignedOfficer');
            assignedOfficer = loan?.assignedOfficer;
          }

          // Escalate session
          session.escalateToHuman(
            functionArgs.preferredMethod || 'in_app_chat',
            assignedOfficer?._id || null,
            functionArgs.reason
          );

          // Send notification to LO if available
          if (assignedOfficer?.phone) {
            await smsNotificationService.sendMessage(
              assignedOfficer.phone,
              `Chatbot escalation from ${req.user.name}: ${functionArgs.reason}. Session: ${sessionId}`
            );
          }

          const escalationMessage = `I've connected you with ${assignedOfficer?.name || 'a loan officer'} via ${functionArgs.preferredMethod}. They will assist you shortly with: ${functionArgs.reason}`;
          session.addMessage('assistant', escalationMessage);
        } else {
          // Execute other functions
          const functionResult = await chatbotKnowledgeService.executeFunction(functionName, functionArgs);
          session.addDataSource(functionName, JSON.stringify(functionArgs), JSON.stringify(functionResult));

          // Add function response
          session.addMessage('function', JSON.stringify(functionResult), null, {
            name: functionName,
            content: JSON.stringify(functionResult)
          });

          // Get final AI response with function result
          const messagesWithFunction = azureOpenAIService.formatConversationHistory(session.messages);
          const finalCompletion = await azureOpenAIService.getChatCompletion(messagesWithFunction, functions);
          const finalMessage = finalCompletion.choices[0].message;

          session.addMessage('assistant', finalMessage.content);
        }
      } else {
        // No function call, just add AI response
        session.addMessage('assistant', aiMessage.content);
      }
    } catch (error) {
      logger.error('AI response error:', error);
      // Fallback response
      const fallbackResponse = azureOpenAIService.generateFallbackResponse(message);
      session.addMessage('assistant', fallbackResponse);
    }

    await session.save();

    // Return only the last assistant message
    const lastMessage = session.messages[session.messages.length - 1];

    res.json({
      success: true,
      message: {
        role: lastMessage.role,
        content: lastMessage.content,
        timestamp: lastMessage.timestamp
      },
      session: {
        sessionId: session.sessionId,
        status: session.status,
        messageCount: session.metadata.messageCount
      }
    });
  } catch (error) {
    logger.error('Send message error:', error);
    next(error);
  }
};

/**
 * Get conversation history for a session
 * @route GET /api/v1/chatbot/session/:sessionId
 */
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatbotSession.findOne({ sessionId, user: req.user._id })
      .populate('loan', 'loanAmount propertyAddress status')
      .populate('escalation.escalatedTo', 'name email phone');

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        loan: session.loan,
        messages: session.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        })),
        escalation: session.escalation.escalated ? {
          escalatedAt: session.escalation.escalatedAt,
          escalatedTo: session.escalation.escalatedTo,
          escalationType: session.escalation.escalationType,
          reason: session.escalation.escalationReason
        } : null,
        metadata: {
          startedAt: session.metadata.startedAt,
          lastMessageAt: session.metadata.lastMessageAt,
          messageCount: session.metadata.messageCount
        }
      }
    });
  } catch (error) {
    logger.error('Get session error:', error);
    next(error);
  }
};

/**
 * Get user's chat sessions
 * @route GET /api/v1/chatbot/sessions
 */
exports.getUserSessions = async (req, res, next) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const sessions = await ChatbotSession.find(query)
      .populate('loan', 'loanAmount propertyAddress status')
      .sort({ 'metadata.lastMessageAt': -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await ChatbotSession.countDocuments(query);

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        status: s.status,
        loan: s.loan,
        lastMessage: s.messages.length > 0 ? {
          content: s.messages[s.messages.length - 1].content.substring(0, 100),
          timestamp: s.messages[s.messages.length - 1].timestamp
        } : null,
        messageCount: s.metadata.messageCount,
        startedAt: s.metadata.startedAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get user sessions error:', error);
    next(error);
  }
};

/**
 * Escalate session to human
 * @route POST /api/v1/chatbot/session/:sessionId/escalate
 */
exports.escalateSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { sessionId } = req.params;
    const { reason, escalationType, urgency } = req.body;

    const session = await ChatbotSession.findOne({ sessionId, user: req.user._id });
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    if (session.status === 'escalated') {
      return next(createError(400, 'Session already escalated'));
    }

    // Find available loan officer
    let assignedOfficer = null;
    if (session.loan) {
      const LoanApplication = require('../models/LoanApplication');
      const loan = await LoanApplication.findById(session.loan).populate('assignedOfficer');
      assignedOfficer = loan?.assignedOfficer;
    }

    // Escalate
    session.escalateToHuman(
      escalationType || 'in_app_chat',
      assignedOfficer?._id || null,
      reason
    );

    // Add system message
    session.addMessage('system', `Session escalated to ${assignedOfficer?.name || 'loan officer'} via ${escalationType || 'in_app_chat'}. Reason: ${reason}`);

    await session.save();

    // Send notification
    if (assignedOfficer?.phone && escalationType === 'sms') {
      await smsNotificationService.sendMessage(
        assignedOfficer.phone,
        `Urgent escalation from ${req.user.name}: ${reason}. Session: ${sessionId}`
      );
    }

    res.json({
      success: true,
      message: 'Session escalated successfully',
      escalation: {
        escalatedTo: assignedOfficer?.name || 'Loan Officer',
        escalationType: session.escalation.escalationType,
        escalatedAt: session.escalation.escalatedAt
      }
    });
  } catch (error) {
    logger.error('Escalate session error:', error);
    next(error);
  }
};

/**
 * Close a chatbot session
 * @route POST /api/v1/chatbot/session/:sessionId/close
 */
exports.closeSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { sessionId } = req.params;
    const { satisfactionRating, feedback } = req.body;

    const session = await ChatbotSession.findOne({ sessionId, user: req.user._id });
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    if (session.status === 'closed') {
      return next(createError(400, 'Session already closed'));
    }

    session.closeSession(satisfactionRating, feedback);
    await session.save();

    res.json({
      success: true,
      message: 'Session closed successfully',
      session: {
        sessionId: session.sessionId,
        status: session.status,
        duration: session.metadata.sessionDuration,
        messageCount: session.metadata.messageCount
      }
    });
  } catch (error) {
    logger.error('Close session error:', error);
    next(error);
  }
};

/**
 * Get chatbot statistics (Admin/BM only)
 * @route GET /api/v1/chatbot/stats
 */
exports.getStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const filters = {};
    if (startDate || endDate) {
      filters['metadata.startedAt'] = {};
      if (startDate) filters['metadata.startedAt'].$gte = new Date(startDate);
      if (endDate) filters['metadata.startedAt'].$lte = new Date(endDate);
    }

    const stats = await ChatbotSession.getSessionStats(filters);

    res.json({
      success: true,
      stats: stats[0] || {
        totalSessions: 0,
        activeSessions: 0,
        escalatedSessions: 0,
        resolvedSessions: 0,
        closedSessions: 0,
        avgMessageCount: 0,
        avgSessionDuration: 0,
        avgSatisfactionRating: 0,
        escalationRate: 0
      }
    });
  } catch (error) {
    logger.error('Get chatbot stats error:', error);
    next(error);
  }
};

/**
 * Get escalated sessions (LO/Admin/BM only)
 * @route GET /api/v1/chatbot/escalated
 */
exports.getEscalatedSessions = async (req, res, next) => {
  try {
    const sessions = await ChatbotSession.findEscalatedSessions();

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        user: s.user,
        loan: s.loan,
        escalatedAt: s.escalation.escalatedAt,
        escalatedTo: s.escalation.escalatedTo,
        escalationType: s.escalation.escalationType,
        reason: s.escalation.escalationReason,
        lastMessage: s.messages.length > 0 ? {
          content: s.messages[s.messages.length - 1].content.substring(0, 100),
          timestamp: s.messages[s.messages.length - 1].timestamp
        } : null
      }))
    });
  } catch (error) {
    logger.error('Get escalated sessions error:', error);
    next(error);
  }
};

/**
 * Resolve escalated session (LO/Admin only)
 * @route POST /api/v1/chatbot/session/:sessionId/resolve
 */
exports.resolveSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { sessionId } = req.params;
    const { resolutionNotes } = req.body;

    const session = await ChatbotSession.findOne({ sessionId });
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    if (session.status !== 'escalated') {
      return next(createError(400, 'Session is not escalated'));
    }

    session.resolveEscalation(resolutionNotes);
    session.addMessage('system', `Session resolved by ${req.user.name}. Notes: ${resolutionNotes}`);
    await session.save();

    res.json({
      success: true,
      message: 'Session resolved successfully',
      session: {
        sessionId: session.sessionId,
        status: session.status,
        resolvedAt: session.escalation.resolvedAt
      }
    });
  } catch (error) {
    logger.error('Resolve session error:', error);
    next(error);
  }
};
