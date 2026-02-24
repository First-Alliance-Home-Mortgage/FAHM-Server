// scripts/seedRoles.js
// Seed script for inserting all roles into the database
//
// Role slugs use underscores (e.g. loan_officer_retail) to match
// src/config/roles.js constants and all authorize() checks in routes/controllers.
//
// See docs/FEATURE_TIER_MATRIX.md for tier-to-capability mapping.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Role = require('../src/models/Role');
const Capability = require('../src/models/Capability');

const ROLES_WITH_CAPABILITIES = [
  // ── Borrower ────────────────────────────────────────────────────────
  // Free tier user — self-service loan tracking, document upload, calculators
  {
    name: 'borrower',
    slug: 'borrower',
    capabilities: [
      // Loan
      'loan:read:self',
      'loan:update:self',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'alerts:manage',
      // Communication
      'messages:send',
      'chatbot:use',
      // Self-service
      'calculator:use',
      'consent:grant',
    ],
  },

  // ── Loan Officer (Retail) ───────────────────────────────────────────
  // Core production role — full loan lifecycle, rate locks, borrower engagement
  {
    name: 'loan_officer_retail',
    slug: 'loan_officer_retail',
    capabilities: [
      // Loan
      'loan:read',
      'loan:update',
      'loan:create',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'rates:lock',
      'alerts:manage',
      // Dashboard
      'dashboard:view',
      // Integrations
      'webhooks:ingest',
      // Credit
      'credit:request',
      'credit:read',
      // Pre-Approval
      'preapproval:generate',
      'preapproval:share',
      // Communication
      'messages:send',
      'sms:send',
      'sms:read',
      'chatbot:use',
      // POS
      'pos:handoff',
      // Referral & Business Cards
      'referral:manage',
      'businesscard:manage',
      // Consent & Compliance
      'consent:manage',
      // Tools
      'calculator:use',
      // CRM
      'crm:manage',
    ],
  },

  // ── Loan Officer (TPO) ─────────────────────────────────────────────
  // Third-party origination — same capabilities as retail LO
  {
    name: 'loan_officer_tpo',
    slug: 'loan_officer_tpo',
    capabilities: [
      // Loan
      'loan:read',
      'loan:update',
      'loan:create',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'rates:lock',
      'alerts:manage',
      // Dashboard
      'dashboard:view',
      // Integrations
      'webhooks:ingest',
      // Credit
      'credit:request',
      'credit:read',
      // Pre-Approval
      'preapproval:generate',
      'preapproval:share',
      // Communication
      'messages:send',
      'sms:send',
      'sms:read',
      'chatbot:use',
      // POS
      'pos:handoff',
      // Referral & Business Cards
      'referral:manage',
      'businesscard:manage',
      // Consent & Compliance
      'consent:manage',
      // Tools
      'calculator:use',
      // CRM
      'crm:manage',
    ],
  },

  // ── Broker ──────────────────────────────────────────────────────────
  // External partner — pipeline view, rate alerts, document upload
  {
    name: 'broker',
    slug: 'broker',
    capabilities: [
      // Loan
      'loan:read',
      'loan:create',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'alerts:manage',
      // Communication
      'messages:send',
      'sms:read',
      'chatbot:use',
      // Credit (read only)
      'credit:read',
      // Business Cards
      'businesscard:manage',
      // Consent
      'consent:manage',
      // Tools
      'calculator:use',
    ],
  },

  // ── Branch Manager ──────────────────────────────────────────────────
  // Team lead — pipeline oversight, branch analytics, user management
  {
    name: 'branch_manager',
    slug: 'branch_manager',
    capabilities: [
      // Loan
      'loan:read',
      'loan:update',
      'loan:create',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'rates:lock',
      'alerts:manage',
      // Dashboard & Analytics
      'dashboard:view',
      'dashboard:branch',
      // Users
      'users:manage:branch',
      // Credit
      'credit:request',
      'credit:read',
      // Pre-Approval
      'preapproval:generate',
      'preapproval:share',
      // Communication
      'messages:send',
      'sms:send',
      'sms:read',
      'chatbot:use',
      // POS
      'pos:handoff',
      // Referral & Business Cards
      'referral:manage',
      'referral:analytics',
      'businesscard:manage',
      // Consent & Compliance
      'consent:manage',
      // Tools
      'calculator:use',
      // CRM
      'crm:manage',
      // Content
      'content:broadcast',
    ],
  },

  // ── Realtor ─────────────────────────────────────────────────────────
  // External referral partner — shared loan view, messaging, rates
  {
    name: 'realtor',
    slug: 'realtor',
    capabilities: [
      // Loan (shared only)
      'loan:read:shared',
      // Rates
      'rates:view',
      // Communication
      'messages:send',
      'chatbot:use',
      // Business Cards
      'businesscard:manage',
      // Tools
      'calculator:use',
    ],
  },

  // ── Admin ───────────────────────────────────────────────────────────
  // Full platform access — all capabilities
  {
    name: 'admin',
    slug: 'admin',
    capabilities: [
      // Loan
      'loan:read',
      'loan:update',
      'loan:create',
      // Document
      'document:upload',
      'document:download',
      // Rates & Alerts
      'rates:view',
      'rates:lock',
      'alerts:manage',
      // Dashboard & Analytics
      'dashboard:view',
      'dashboard:branch',
      // Webhooks
      'webhooks:ingest',
      // Users
      'users:manage',
      // Audit
      'audit:read',
      'audit:view',
      // CMS & Menus
      'cms:manage',
      'menu:manage',
      'featureflags:manage',
      'content:broadcast',
      // Credit
      'credit:request',
      'credit:read',
      // Pre-Approval
      'preapproval:generate',
      'preapproval:share',
      // Communication
      'messages:send',
      'sms:send',
      'sms:read',
      'chatbot:use',
      // POS
      'pos:handoff',
      // Referral & Business Cards
      'referral:manage',
      'referral:analytics',
      'businesscard:manage',
      // Consent & Compliance
      'consent:manage',
      // Tools
      'calculator:use',
      // CRM
      'crm:manage',
      // Tenant & Billing
      'tenant:manage',
      'billing:manage',
    ],
  },
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Upserting roles with capabilities (preserving existing ObjectIds)...\n');

    let created = 0;
    let updated = 0;

    for (const roleData of ROLES_WITH_CAPABILITIES) {
      // Find capability ObjectIds by name
      const capabilityDocs = await Capability.find({
        name: { $in: roleData.capabilities }
      }).select('_id name');

      const capabilityIds = capabilityDocs.map(cap => cap._id);

      // Warn about missing capabilities
      const foundNames = capabilityDocs.map(cap => cap.name);
      const missing = roleData.capabilities.filter(c => !foundNames.includes(c));
      if (missing.length > 0) {
        console.warn(`  WARNING: Role "${roleData.name}" references missing capabilities: ${missing.join(', ')}`);
      }

      // Upsert role by slug (preserves ObjectId for existing roles)
      const result = await Role.findOneAndUpdate(
        { slug: roleData.slug },
        { $set: { name: roleData.name, slug: roleData.slug, capabilities: capabilityIds } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const wasNew = result.createdAt?.getTime() === result.updatedAt?.getTime();
      if (wasNew) created++; else updated++;
      console.log(`  ${wasNew ? '+ created' : '~ updated'} Role "${roleData.name}" (slug: ${roleData.slug}) -> ${capabilityIds.length} capabilities`);
    }

    // Remove roles no longer in the seed list
    const seedSlugs = ROLES_WITH_CAPABILITIES.map(r => r.slug);
    const removed = await Role.deleteMany({ slug: { $nin: seedSlugs } });
    if (removed.deletedCount > 0) {
      console.log(`\n  Removed ${removed.deletedCount} obsolete roles`);
    }

    console.log(`\nDone: ${created} created, ${updated} updated, ${removed.deletedCount} removed`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding roles:', err);
    process.exit(1);
  }
}

seedRoles();
