// scripts/seedCapabilities.js
// Seed script for inserting all capabilities into the database
//
// Capabilities are grouped by category and cover the full FAHM platform feature set.
// See docs/FEATURE_TIER_MATRIX.md for tier-to-capability mapping.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Capability = require('../src/models/Capability');

const ALL_CAPABILITIES = [
  // ── Loan ──────────────────────────────────────────────────────────────
  { name: 'loan:read:self', slug: 'loan-read-self', description: 'Read own loan information', category: 'loan' },
  { name: 'loan:update:self', slug: 'loan-update-self', description: 'Update own loan information', category: 'loan' },
  { name: 'loan:read', slug: 'loan-read', description: 'Read all loan information', category: 'loan' },
  { name: 'loan:update', slug: 'loan-update', description: 'Update loan information', category: 'loan' },
  { name: 'loan:create', slug: 'loan-create', description: 'Create new loans', category: 'loan' },
  { name: 'loan:read:shared', slug: 'loan-read-shared', description: 'Read shared loan information (referral partners)', category: 'loan' },

  // ── Document ──────────────────────────────────────────────────────────
  { name: 'document:upload', slug: 'document-upload', description: 'Upload documents to loans', category: 'document' },
  { name: 'document:download', slug: 'document-download', description: 'Download loan documents', category: 'document' },

  // ── Rates ─────────────────────────────────────────────────────────────
  { name: 'rates:view', slug: 'rates-view', description: 'View mortgage rates and product pricing', category: 'rates' },
  { name: 'rates:lock', slug: 'rates-lock', description: 'Submit and manage rate lock requests', category: 'rates' },

  // ── Alerts ────────────────────────────────────────────────────────────
  { name: 'alerts:manage', slug: 'alerts-manage', description: 'Create, update, and delete rate alerts', category: 'alerts' },

  // ── Messages ──────────────────────────────────────────────────────────
  { name: 'messages:send', slug: 'messages-send', description: 'Send in-app messages on loans', category: 'messages' },

  // ── Dashboard ─────────────────────────────────────────────────────────
  { name: 'dashboard:view', slug: 'dashboard-view', description: 'View dashboard metrics and reports', category: 'dashboard' },
  { name: 'dashboard:branch', slug: 'dashboard-branch', description: 'View branch performance analytics', category: 'dashboard' },

  // ── Webhooks ──────────────────────────────────────────────────────────
  { name: 'webhooks:ingest', slug: 'webhooks-ingest', description: 'Receive and process webhook data from integrations', category: 'webhooks' },

  // ── Users ─────────────────────────────────────────────────────────────
  { name: 'users:manage', slug: 'users-manage', description: 'Full user management (create, update, deactivate)', category: 'users' },
  { name: 'users:manage:branch', slug: 'users-manage-branch', description: 'Manage users within own branch', category: 'users' },

  // ── Audit ─────────────────────────────────────────────────────────────
  { name: 'audit:read', slug: 'audit-read', description: 'Read audit log entries', category: 'audit' },
  { name: 'audit:view', slug: 'audit-view', description: 'View audit logs (consent, CRM, credit)', category: 'audit' },

  // ── CMS & Menus ───────────────────────────────────────────────────────
  { name: 'cms:manage', slug: 'cms-manage', description: 'Create, edit, publish CMS screens and navigation configs', category: 'cms' },
  { name: 'menu:manage', slug: 'menu-manage', description: 'Create, edit, delete, restore dynamic menus', category: 'cms' },
  { name: 'featureflags:manage', slug: 'featureflags-manage', description: 'Toggle and configure feature flags', category: 'cms' },

  // ── Credit ────────────────────────────────────────────────────────────
  { name: 'credit:request', slug: 'credit-request', description: 'Request tri-merge credit reports via Xactus', category: 'credit' },
  { name: 'credit:read', slug: 'credit-read', description: 'View credit reports and pull history', category: 'credit' },

  // ── Pre-Approval ──────────────────────────────────────────────────────
  { name: 'preapproval:generate', slug: 'preapproval-generate', description: 'Generate PDF pre-approval letters', category: 'preapproval' },
  { name: 'preapproval:share', slug: 'preapproval-share', description: 'Share pre-approval letters via SMS and email', category: 'preapproval' },

  // ── SMS ───────────────────────────────────────────────────────────────
  { name: 'sms:send', slug: 'sms-send', description: 'Send SMS messages via Twilio', category: 'sms' },
  { name: 'sms:read', slug: 'sms-read', description: 'Read SMS conversation threads', category: 'sms' },

  // ── Chatbot ───────────────────────────────────────────────────────────
  { name: 'chatbot:use', slug: 'chatbot-use', description: 'Use AI chatbot (Azure OpenAI) sessions', category: 'chatbot' },

  // ── POS ───────────────────────────────────────────────────────────────
  { name: 'pos:handoff', slug: 'pos-handoff', description: 'Create POS handoff sessions (Blend, BigPOS)', category: 'pos' },

  // ── Referral Sources ──────────────────────────────────────────────────
  { name: 'referral:manage', slug: 'referral-manage', description: 'Manage referral sources and co-branding config', category: 'referral' },
  { name: 'referral:analytics', slug: 'referral-analytics', description: 'View referral source analytics (leads, conversions)', category: 'referral' },

  // ── Business Cards ────────────────────────────────────────────────────
  { name: 'businesscard:manage', slug: 'businesscard-manage', description: 'Create and manage digital business cards with QR codes', category: 'businesscard' },

  // ── Consent ───────────────────────────────────────────────────────────
  { name: 'consent:manage', slug: 'consent-manage', description: 'View and manage borrower data-sharing consents', category: 'consent' },
  { name: 'consent:grant', slug: 'consent-grant', description: 'Grant data-sharing consent (borrower)', category: 'consent' },

  // ── Calculator ────────────────────────────────────────────────────────
  { name: 'calculator:use', slug: 'calculator-use', description: 'Use mortgage calculators (P&I, APR, amortization, affordability)', category: 'calculator' },

  // ── CRM ───────────────────────────────────────────────────────────────
  { name: 'crm:manage', slug: 'crm-manage', description: 'Manage CRM sync, contacts, and journeys (Total Expert)', category: 'crm' },

  // ── Content Updates ───────────────────────────────────────────────────
  { name: 'content:broadcast', slug: 'content-broadcast', description: 'Broadcast content update events via WebSocket', category: 'cms' },

  // ── Tenant & Billing ──────────────────────────────────────────────────
  { name: 'tenant:manage', slug: 'tenant-manage', description: 'Manage tenant/organization settings and seat limits', category: 'tenant' },
  { name: 'billing:manage', slug: 'billing-manage', description: 'Manage subscription billing, invoices, and usage', category: 'billing' },
];

async function seedCapabilities() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Cleaning up existing capabilities...');
    const deleteResult = await Capability.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing capabilities`);

    console.log('Seeding capabilities...');

    for (const capData of ALL_CAPABILITIES) {
      await Capability.create(capData);
      console.log(`  ✓ ${capData.category.padEnd(14)} ${capData.name}`);
    }

    console.log(`\nSuccessfully seeded ${ALL_CAPABILITIES.length} capabilities`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding capabilities:', err);
    process.exit(1);
  }
}

seedCapabilities();
