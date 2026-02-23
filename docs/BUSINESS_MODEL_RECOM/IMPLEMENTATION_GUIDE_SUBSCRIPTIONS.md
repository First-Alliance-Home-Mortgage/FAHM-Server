# FAHM Platform — Subscription System Implementation Guide

> Technical implementation guide for adding multi-tenant subscription billing, tier-gating, and usage metering to the FAHM-Server backend.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [New Data Models](#new-data-models)
3. [Middleware: Tier Gating](#middleware-tier-gating)
4. [Middleware: Usage Metering](#middleware-usage-metering)
5. [Stripe Billing Integration](#stripe-billing-integration)
6. [API Endpoints](#api-endpoints)
7. [Feature Flag Integration](#feature-flag-integration)
8. [Migration Strategy](#migration-strategy)
9. [Testing Plan](#testing-plan)

---

## Architecture Overview

### Current State

```
User → auth middleware (JWT + role/capabilities) → route handler
```

### Target State

```
User → auth middleware → tenant middleware → tier-gate middleware → usage-meter middleware → route handler
                              ↓                      ↓                       ↓
                        Tenant lookup          Check subscription       Track usage
                        (cached 5 min)         tier allows access       per tenant
```

### New Files to Create

```
src/models/Tenant.js                    -- Tenant/organization model
src/models/UsageRecord.js               -- Usage metering records
src/middleware/tenant.js                 -- Attach tenant to request
src/middleware/requireTier.js            -- Tier-gate middleware
src/middleware/meterUsage.js             -- Usage tracking middleware
src/controllers/tenantController.js     -- Tenant CRUD + billing
src/controllers/billingController.js    -- Stripe webhook + portal
src/routes/tenants.js                   -- Tenant management routes
src/routes/billing.js                   -- Billing/subscription routes
src/services/stripeService.js           -- Stripe API wrapper
src/services/usageService.js            -- Usage aggregation/limits
src/jobs/usageSyncJob.js                -- Monthly usage sync to Stripe
```

### Existing Files to Modify

```
src/models/User.js                      -- Add tenantId field
src/middleware/auth.js                   -- Populate tenant after auth
src/app.js                              -- Register new routes
src/server.js                           -- Register usage sync job
```

---

## New Data Models

### Tenant Model (`src/models/Tenant.js`)

```js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Organization info
  companyName: { type: String, required: true, trim: true },
  companyDomain: { type: String, trim: true },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
  },
  phone: String,
  website: String,

  // Subscription
  subscriptionTier: {
    type: String,
    enum: ['starter', 'professional', 'enterprise'],
    default: 'starter',
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
    default: 'trialing',
  },
  trialEndsAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,

  // Seat limits (per role)
  seatLimits: {
    loanOfficer: { type: Number, default: 5 },
    branchManager: { type: Number, default: 1 },
    broker: { type: Number, default: 5 },
    realtor: { type: Number, default: 5 },
    admin: { type: Number, default: 1 },
    // borrower seats are always unlimited
  },

  // Enabled integrations
  enabledIntegrations: [{
    type: String,
    enum: [
      'encompass', 'optimal_blue', 'total_expert',
      'xactus', 'blend', 'bigpos', 'power_bi',
      'twilio', 'azure_openai',
    ],
  }],

  // Enabled features (beyond tier defaults)
  enabledFeatures: [{
    type: String,
    enum: [
      'co_branding', 'custom_domain', 'white_label',
      'api_write_access', 'advanced_audit', 'pos_handoff',
    ],
  }],

  // Usage quotas (monthly)
  usageQuotas: {
    creditPulls: { type: Number, default: 0 },       // 0 = unlimited
    smsMessages: { type: Number, default: 0 },
    aiChatbotMessages: { type: Number, default: 0 },
    storageGB: { type: Number, default: 10 },
  },

  // Current period usage (reset monthly)
  currentUsage: {
    creditPulls: { type: Number, default: 0 },
    smsMessages: { type: Number, default: 0 },
    aiChatbotMessages: { type: Number, default: 0 },
    storageGB: { type: Number, default: 0 },
  },

  // Stripe billing
  stripe: {
    customerId: String,
    subscriptionId: String,
    priceId: String,
    paymentMethodId: String,
  },

  // Metadata
  primaryContact: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  onboardedAt: Date,
  notes: String,

}, {
  timestamps: true,
});

// Indexes
tenantSchema.index({ companyName: 1 });
tenantSchema.index({ 'stripe.customerId': 1 }, { unique: true, sparse: true });
tenantSchema.index({ subscriptionStatus: 1 });

// Virtuals
tenantSchema.virtual('isTrialing').get(function () {
  return this.subscriptionStatus === 'trialing' && this.trialEndsAt > new Date();
});

tenantSchema.virtual('isSubscriptionActive').get(function () {
  return ['active', 'trialing'].includes(this.subscriptionStatus);
});

// Methods
tenantSchema.methods.hasIntegration = function (integration) {
  return this.enabledIntegrations.includes(integration);
};

tenantSchema.methods.hasFeature = function (feature) {
  return this.enabledFeatures.includes(feature);
};

tenantSchema.methods.isWithinQuota = function (usageType) {
  const quota = this.usageQuotas[usageType];
  if (quota === 0) return true; // 0 = unlimited
  return this.currentUsage[usageType] < quota;
};

module.exports = mongoose.model('Tenant', tenantSchema);
```

### Usage Record Model (`src/models/UsageRecord.js`)

```js
const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usageType: {
    type: String,
    enum: ['credit_pull', 'sms_message', 'ai_chatbot_message', 'storage_upload', 'api_call'],
    required: true,
  },
  quantity: { type: Number, default: 1 },
  metadata: mongoose.Schema.Types.Mixed,
  billingPeriod: { type: String, required: true }, // e.g., "2026-02"
  reportedToStripe: { type: Boolean, default: false },
}, {
  timestamps: true,
});

usageRecordSchema.index({ tenant: 1, billingPeriod: 1, usageType: 1 });
usageRecordSchema.index({ reportedToStripe: 1 });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
```

### User Model Update

Add `tenantId` to the existing `src/models/User.js`:

```js
// Add to existing User schema fields:
tenant: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true,
},
```

---

## Middleware: Tier Gating

### `src/middleware/requireTier.js`

```js
/**
 * Middleware to gate routes by subscription tier.
 *
 * Usage:
 *   router.post('/rate-locks', auth, requireTier('professional'), rateLockController.create);
 *   router.get('/power-bi', auth, requireTier('enterprise'), dashboardController.embed);
 */
const requireTier = (...allowedTiers) => {
  return (req, res, next) => {
    const tenant = req.tenant;

    if (!tenant) {
      return res.status(500).json({ error: 'Tenant context not found' });
    }

    if (!tenant.isSubscriptionActive) {
      return res.status(403).json({
        error: 'Subscription inactive',
        message: 'Your subscription is not active. Please update your billing information.',
        subscriptionStatus: tenant.subscriptionStatus,
      });
    }

    // Tier hierarchy: enterprise > professional > starter
    const tierRank = { starter: 1, professional: 2, enterprise: 3 };
    const tenantRank = tierRank[tenant.subscriptionTier] || 0;
    const requiredRank = Math.min(...allowedTiers.map(t => tierRank[t] || 999));

    if (tenantRank < requiredRank) {
      return res.status(403).json({
        error: 'Upgrade required',
        message: `This feature requires a ${allowedTiers[0]} plan or higher.`,
        currentTier: tenant.subscriptionTier,
        requiredTier: allowedTiers[0],
        upgradeUrl: '/billing/upgrade',
      });
    }

    next();
  };
};

module.exports = requireTier;
```

### `src/middleware/requireIntegration.js`

```js
/**
 * Middleware to gate routes by enabled integrations.
 *
 * Usage:
 *   router.get('/encompass/pipeline', auth, requireIntegration('encompass'), encompassController.pipeline);
 */
const requireIntegration = (integration) => {
  return (req, res, next) => {
    const tenant = req.tenant;

    if (!tenant) {
      return res.status(500).json({ error: 'Tenant context not found' });
    }

    if (!tenant.hasIntegration(integration)) {
      return res.status(403).json({
        error: 'Integration not enabled',
        message: `The ${integration} integration is not enabled for your account.`,
        integration,
        upgradeUrl: '/billing/integrations',
      });
    }

    next();
  };
};

module.exports = requireIntegration;
```

### `src/middleware/tenant.js`

```js
const Tenant = require('../models/Tenant');

// Simple in-memory cache (replace with Redis in production)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to attach tenant context to the request.
 * Must run AFTER auth middleware (requires req.user).
 */
const attachTenant = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant;

    if (!tenantId) {
      return res.status(403).json({ error: 'User is not associated with a tenant' });
    }

    // Check cache
    const cached = tenantCache.get(tenantId.toString());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      req.tenant = cached.tenant;
      return next();
    }

    // Fetch from DB
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(403).json({ error: 'Tenant not found' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Tenant account has been deactivated' });
    }

    // Hydrate virtual-like checks (lean() doesn't compute virtuals)
    tenant.isSubscriptionActive = ['active', 'trialing'].includes(tenant.subscriptionStatus);
    tenant.hasIntegration = (integration) => tenant.enabledIntegrations.includes(integration);
    tenant.hasFeature = (feature) => tenant.enabledFeatures.includes(feature);
    tenant.isWithinQuota = (usageType) => {
      const quota = tenant.usageQuotas[usageType];
      if (quota === 0) return true;
      return tenant.currentUsage[usageType] < quota;
    };

    // Cache
    tenantCache.set(tenantId.toString(), { tenant, timestamp: Date.now() });
    req.tenant = tenant;
    next();
  } catch (error) {
    req.log.error({ error }, 'Failed to attach tenant context');
    next(error);
  }
};

// Export cache-clearing utility for tests and billing updates
attachTenant.clearCache = (tenantId) => {
  if (tenantId) {
    tenantCache.delete(tenantId.toString());
  } else {
    tenantCache.clear();
  }
};

module.exports = attachTenant;
```

---

## Middleware: Usage Metering

### `src/middleware/meterUsage.js`

```js
const UsageRecord = require('../models/UsageRecord');
const Tenant = require('../models/Tenant');

/**
 * Middleware to track and enforce usage quotas.
 *
 * Usage:
 *   router.post('/credit/:loanId/request', auth, meterUsage('credit_pull'), creditController.request);
 *   router.post('/sms/send', auth, meterUsage('sms_message'), smsController.send);
 */
const meterUsage = (usageType, { quantityFn } = {}) => {
  // Map usage types to quota field names
  const quotaMap = {
    credit_pull: 'creditPulls',
    sms_message: 'smsMessages',
    ai_chatbot_message: 'aiChatbotMessages',
    storage_upload: 'storageGB',
  };

  return async (req, res, next) => {
    const tenant = req.tenant;
    const quotaField = quotaMap[usageType];

    if (!tenant || !quotaField) {
      return next();
    }

    // Check quota before allowing the action
    if (!tenant.isWithinQuota(quotaField)) {
      return res.status(429).json({
        error: 'Usage quota exceeded',
        message: `You have reached your monthly ${usageType.replace('_', ' ')} limit.`,
        usageType,
        currentUsage: tenant.currentUsage[quotaField],
        quota: tenant.usageQuotas[quotaField],
        upgradeUrl: '/billing/usage',
      });
    }

    // Calculate quantity
    const quantity = quantityFn ? quantityFn(req) : 1;

    // Record usage (fire-and-forget for performance)
    const billingPeriod = new Date().toISOString().slice(0, 7); // "2026-02"
    UsageRecord.create({
      tenant: tenant._id,
      user: req.user._id,
      usageType,
      quantity,
      billingPeriod,
      metadata: { path: req.path, method: req.method },
    }).catch(err => req.log.error({ err }, 'Failed to record usage'));

    // Increment tenant usage counter (atomic)
    Tenant.updateOne(
      { _id: tenant._id },
      { $inc: { [`currentUsage.${quotaField}`]: quantity } }
    ).catch(err => req.log.error({ err }, 'Failed to increment tenant usage'));

    next();
  };
};

module.exports = meterUsage;
```

---

## Stripe Billing Integration

### `src/services/stripeService.js`

```js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs (configure in Stripe Dashboard)
const PRICE_IDS = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  },
  // Enterprise uses custom quotes
};

// Metered price IDs for usage-based billing
const METERED_PRICE_IDS = {
  credit_pull: process.env.STRIPE_PRICE_CREDIT_PULL,
  sms_message: process.env.STRIPE_PRICE_SMS_MESSAGE,
  ai_chatbot_message: process.env.STRIPE_PRICE_AI_MESSAGE,
};

// Seat price IDs
const SEAT_PRICE_IDS = {
  loan_officer: process.env.STRIPE_PRICE_SEAT_LO,
  branch_manager: process.env.STRIPE_PRICE_SEAT_BM,
  broker: process.env.STRIPE_PRICE_SEAT_BROKER,
  realtor: process.env.STRIPE_PRICE_SEAT_REALTOR,
  admin: process.env.STRIPE_PRICE_SEAT_ADMIN,
};

const stripeService = {
  /**
   * Create a Stripe customer for a new tenant.
   */
  async createCustomer(tenant) {
    return stripe.customers.create({
      name: tenant.companyName,
      email: tenant.primaryContactEmail,
      metadata: {
        tenantId: tenant._id.toString(),
        tier: tenant.subscriptionTier,
      },
    });
  },

  /**
   * Create a subscription for a tenant.
   */
  async createSubscription(customerId, tier, billingCycle = 'monthly') {
    const priceId = PRICE_IDS[tier]?.[billingCycle];
    if (!priceId) throw new Error(`No price configured for ${tier}/${billingCycle}`);

    return stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: tier === 'starter' ? 14 : 60,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  },

  /**
   * Update subscription tier (upgrade/downgrade).
   */
  async updateSubscription(subscriptionId, newTier, billingCycle = 'monthly') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = PRICE_IDS[newTier]?.[billingCycle];
    if (!priceId) throw new Error(`No price configured for ${newTier}/${billingCycle}`);

    return stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    });
  },

  /**
   * Report metered usage to Stripe.
   */
  async reportUsage(subscriptionId, usageType, quantity, timestamp) {
    const meteredPriceId = METERED_PRICE_IDS[usageType];
    if (!meteredPriceId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const meteredItem = subscription.items.data.find(
      item => item.price.id === meteredPriceId
    );

    if (meteredItem) {
      return stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity,
        timestamp: Math.floor(timestamp / 1000),
        action: 'increment',
      });
    }
  },

  /**
   * Create a billing portal session for self-service.
   */
  async createPortalSession(customerId, returnUrl) {
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  },

  /**
   * Verify Stripe webhook signature.
   */
  verifyWebhookSignature(payload, signature) {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },
};

module.exports = stripeService;
```

### Stripe Webhook Handler (`src/controllers/billingController.js`)

```js
const Tenant = require('../models/Tenant');
const stripeService = require('../services/stripeService');
const attachTenant = require('../middleware/tenant');
const logger = require('../utils/logger');

const billingController = {
  /**
   * POST /billing/webhook
   * Handle Stripe webhook events.
   */
  async handleWebhook(req, res) {
    let event;

    try {
      event = stripeService.verifyWebhookSignature(
        req.body,
        req.headers['stripe-signature']
      );
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const handlers = {
      'customer.subscription.updated': async (data) => {
        const subscription = data.object;
        const tenant = await Tenant.findOne({
          'stripe.subscriptionId': subscription.id,
        });
        if (!tenant) return;

        tenant.subscriptionStatus = subscription.status;
        tenant.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        tenant.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        await tenant.save();

        // Clear tenant cache
        attachTenant.clearCache(tenant._id);
      },

      'customer.subscription.deleted': async (data) => {
        const subscription = data.object;
        const tenant = await Tenant.findOne({
          'stripe.subscriptionId': subscription.id,
        });
        if (!tenant) return;

        tenant.subscriptionStatus = 'canceled';
        await tenant.save();
        attachTenant.clearCache(tenant._id);
      },

      'invoice.payment_failed': async (data) => {
        const invoice = data.object;
        const tenant = await Tenant.findOne({
          'stripe.customerId': invoice.customer,
        });
        if (!tenant) return;

        tenant.subscriptionStatus = 'past_due';
        await tenant.save();
        attachTenant.clearCache(tenant._id);

        // TODO: Send notification to tenant primary contact
      },

      'invoice.paid': async (data) => {
        const invoice = data.object;
        const tenant = await Tenant.findOne({
          'stripe.customerId': invoice.customer,
        });
        if (!tenant) return;

        // Reset monthly usage counters on successful payment
        tenant.currentUsage = {
          creditPulls: 0,
          smsMessages: 0,
          aiChatbotMessages: 0,
          storageGB: tenant.currentUsage.storageGB, // storage doesn't reset
        };
        tenant.subscriptionStatus = 'active';
        await tenant.save();
        attachTenant.clearCache(tenant._id);
      },
    };

    const handler = handlers[event.type];
    if (handler) {
      try {
        await handler(event.data);
        logger.info({ eventType: event.type }, 'Stripe webhook processed');
      } catch (err) {
        logger.error({ err, eventType: event.type }, 'Stripe webhook handler failed');
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }

    res.json({ received: true });
  },

  /**
   * POST /billing/portal
   * Create a Stripe billing portal session for self-service management.
   */
  async createPortalSession(req, res) {
    const tenant = req.tenant;
    if (!tenant.stripe?.customerId) {
      return res.status(400).json({ error: 'No billing account configured' });
    }

    const session = await stripeService.createPortalSession(
      tenant.stripe.customerId,
      `${process.env.FRONTEND_URL}/settings/billing`
    );

    res.json({ url: session.url });
  },

  /**
   * GET /billing/usage
   * Get current billing period usage for the tenant.
   */
  async getUsage(req, res) {
    const tenant = req.tenant;
    res.json({
      currentPeriod: {
        start: tenant.currentPeriodStart,
        end: tenant.currentPeriodEnd,
      },
      usage: tenant.currentUsage,
      quotas: tenant.usageQuotas,
      tier: tenant.subscriptionTier,
    });
  },
};

module.exports = billingController;
```

---

## API Endpoints

### New Routes to Register in `src/app.js`

```js
// Tenant management
app.use('/api/v1/tenants', require('./routes/tenants'));

// Billing & subscriptions
app.use('/api/v1/billing', require('./routes/billing'));
```

### Tenant Routes (`src/routes/tenants.js`)

| Method | Path | Auth | Tier | Description |
|--------|------|------|------|-------------|
| `GET` | `/tenants/me` | Yes | Any | Get current user's tenant info |
| `PATCH` | `/tenants/me` | Yes | Any | Update tenant profile (admin only) |
| `GET` | `/tenants/me/seats` | Yes | Any | Get seat usage vs. limits |
| `GET` | `/tenants/me/usage` | Yes | Any | Get current usage vs. quotas |
| `GET` | `/tenants` | Yes | Admin | List all tenants (super-admin) |
| `POST` | `/tenants` | Yes | Admin | Create tenant (super-admin) |
| `GET` | `/tenants/:id` | Yes | Admin | Get tenant by ID (super-admin) |
| `PATCH` | `/tenants/:id` | Yes | Admin | Update tenant (super-admin) |

### Billing Routes (`src/routes/billing.js`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/billing/webhook` | No (Stripe signature) | Stripe webhook handler |
| `POST` | `/billing/portal` | Yes | Create Stripe billing portal session |
| `GET` | `/billing/usage` | Yes | Get current period usage |
| `POST` | `/billing/upgrade` | Yes | Initiate tier upgrade |
| `GET` | `/billing/invoices` | Yes | List past invoices |

---

## Feature Flag Integration

The existing `FeatureFlag` model already supports role-based and version-based gating. Extend it for tier-based gating:

### FeatureFlag Model Update

```js
// Add to existing FeatureFlag schema:
requiredTier: {
  type: String,
  enum: ['starter', 'professional', 'enterprise', null],
  default: null, // null = available to all tiers
},
requiredIntegration: {
  type: String,
  enum: [
    'encompass', 'optimal_blue', 'total_expert',
    'xactus', 'blend', 'bigpos', 'power_bi', null
  ],
  default: null,
},
```

### Updated Feature Flag Check Logic

```js
// In CMS feature flag endpoint, filter flags by tenant tier + integrations:
const getFeatureFlags = async (req, res) => {
  const flags = await FeatureFlag.find({});
  const tenant = req.tenant;
  const userRole = req.user.role.slug;

  const tierRank = { starter: 1, professional: 2, enterprise: 3 };
  const tenantRank = tierRank[tenant.subscriptionTier] || 0;

  const filteredFlags = flags.map(flag => {
    let enabled = flag.enabled;

    // Check role restriction
    if (flag.roles?.length > 0 && !flag.roles.includes(userRole)) {
      enabled = false;
    }

    // Check tier restriction
    if (flag.requiredTier) {
      const requiredRank = tierRank[flag.requiredTier] || 0;
      if (tenantRank < requiredRank) {
        enabled = false;
      }
    }

    // Check integration restriction
    if (flag.requiredIntegration && !tenant.hasIntegration(flag.requiredIntegration)) {
      enabled = false;
    }

    return { key: flag.key, enabled };
  });

  res.json(filteredFlags);
};
```

---

## Migration Strategy

### Phase 1: Data Model (Week 1)

1. Create `Tenant` and `UsageRecord` models
2. Add `tenant` field to `User` model (nullable initially)
3. Create migration script to:
   - Create a default tenant for all existing users
   - Set all existing users' `tenant` to the default tenant
   - Set default tenant to `professional` tier (full access)

### Phase 2: Middleware (Week 2)

1. Implement `attachTenant` middleware
2. Implement `requireTier` middleware
3. Implement `requireIntegration` middleware
4. Add middleware to existing routes (behind feature flag so it can be toggled)

### Phase 3: Billing (Week 3-4)

1. Set up Stripe products, prices, and metered billing
2. Implement `stripeService.js`
3. Implement webhook handler
4. Build billing portal redirect

### Phase 4: Usage Metering (Week 4-5)

1. Implement `meterUsage` middleware
2. Add metering to credit, SMS, and chatbot routes
3. Implement `usageSyncJob` for Stripe reporting
4. Build usage dashboard API endpoints

### Phase 5: Launch (Week 6)

1. Enable tier-gating middleware
2. Configure tier defaults for new tenants
3. Test full billing lifecycle (trial → subscribe → usage → invoice → payment)
4. Launch pilot program

---

## Route Integration Examples

Here is how existing routes would be updated to add tier-gating:

```js
// src/routes/rates.js — Add tier gating to rate locks
const requireTier = require('../middleware/requireTier');
const requireIntegration = require('../middleware/requireIntegration');

// Rate locks require Professional tier + Optimal Blue integration
router.post('/locks',
  auth,
  requireTier('professional'),
  requireIntegration('optimal_blue'),
  rateController.createLock
);

// src/routes/credit.js — Add tier gating + usage metering
const meterUsage = require('../middleware/meterUsage');

router.post('/:loanId/request',
  auth,
  requireTier('professional'),
  requireIntegration('xactus'),
  meterUsage('credit_pull'),
  creditController.requestReport
);

// src/routes/sms.js — Add usage metering
router.post('/send',
  auth,
  requireTier('professional'),
  requireIntegration('twilio'),
  meterUsage('sms_message'),
  smsController.send
);

// src/routes/chatbot.js — Add usage metering
router.post('/sessions/:id/messages',
  auth,
  requireTier('professional'),
  requireIntegration('azure_openai'),
  meterUsage('ai_chatbot_message'),
  chatbotController.sendMessage
);

// src/routes/dashboard.js — Power BI requires Enterprise
router.get('/reports/:reportId/embed',
  auth,
  requireTier('enterprise'),
  requireIntegration('power_bi'),
  dashboardController.getEmbedConfig
);
```

---

## Environment Variables

Add these to `.env`:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...

# Stripe Metered Price IDs
STRIPE_PRICE_CREDIT_PULL=price_...
STRIPE_PRICE_SMS_MESSAGE=price_...
STRIPE_PRICE_AI_MESSAGE=price_...

# Stripe Seat Price IDs
STRIPE_PRICE_SEAT_LO=price_...
STRIPE_PRICE_SEAT_BM=price_...
STRIPE_PRICE_SEAT_BROKER=price_...
STRIPE_PRICE_SEAT_REALTOR=price_...
STRIPE_PRICE_SEAT_ADMIN=price_...
```

---

## Testing Plan

### Unit Tests

| Test | File |
|------|------|
| Tenant model validation | `tests/models/Tenant.test.js` |
| `requireTier` middleware (all tiers) | `tests/middleware/requireTier.test.js` |
| `requireIntegration` middleware | `tests/middleware/requireIntegration.test.js` |
| `meterUsage` middleware (quota enforcement) | `tests/middleware/meterUsage.test.js` |
| `attachTenant` middleware (caching) | `tests/middleware/tenant.test.js` |
| Stripe service (mocked) | `tests/services/stripeService.test.js` |

### Integration Tests

| Test | Description |
|------|-------------|
| Tier upgrade flow | Create tenant on Starter → upgrade to Professional → verify access to gated routes |
| Usage quota enforcement | Send requests until quota exceeded → verify 429 response |
| Stripe webhook handling | Simulate `invoice.paid` → verify usage reset |
| Seat limit enforcement | Add users beyond seat limit → verify rejection |
| Billing portal redirect | Create portal session → verify redirect URL |

### End-to-End Tests

| Test | Description |
|------|-------------|
| Full trial lifecycle | Register → trial → subscribe → use features → invoice → renew |
| Downgrade flow | Professional → Starter → verify Professional features are gated |
| Payment failure | Simulate failed payment → verify `past_due` status → re-activate |

---

## Related Documents

- [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — Pricing tiers and revenue model
- [FEATURE_TIER_MATRIX.md](./FEATURE_TIER_MATRIX.md) — Detailed feature-to-tier mapping
- [API_REFERENCE.md](./API_REFERENCE.md) — Full API endpoint reference
