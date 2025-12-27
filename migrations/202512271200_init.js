exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.string('name', 255).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('role', 50).notNullable();
    t.string('phone', 50);
    t.string('azure_ad_b2c_id', 255).unique().nullable();
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('nmls', 100);
    t.string('title', 255);
    t.string('photo', 512);
    t.string('branch_name', 255);
    t.string('branch_address', 255);
    t.string('branch_city', 100);
    t.string('branch_state', 50);
    t.string('branch_zip', 20);
    t.string('branch_phone', 50);
    t.string('legacy_mongo_id', 24);
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());

    t.index(['role', 'is_active'], 'idx_users_role_active');
    t.index(['email_verified', 'is_active'], 'idx_users_verified_active');
  });

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('token_hash', 255).notNullable().unique();
    t.datetime('expires_at').notNullable();
    t.datetime('revoked_at');
    t.string('revoked_reason', 100);
    t.uuid('replaced_by').references('refresh_tokens.id').onDelete('SET NULL');
    t.string('metadata_json', 4000);
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());

    t.index(['user_id', 'revoked_at'], 'idx_refresh_user_revoked');
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('user_id').references('users.id').onDelete('SET NULL');
    t.string('action', 100).notNullable();
    t.string('entity_type', 100);
    t.string('entity_id', 100);
    t.string('status', 20).notNullable().defaultTo('success');
    t.string('ip', 100);
    t.string('user_agent', 500);
    t.string('metadata_json', 4000);
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());

    t.index(['user_id', 'created_at'], 'idx_audit_user_created');
    t.index(['entity_type', 'entity_id'], 'idx_audit_entity');
    t.index(['action', 'status', 'created_at'], 'idx_audit_action_status');
  });

  await knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('user_id').references('users.id').onDelete('SET NULL');
    t.string('name', 255).notNullable();
    t.string('status', 50).notNullable();
    t.string('blob_path', 512);
    t.string('mime_type', 100);
    t.bigInteger('size_bytes');
    t.string('legacy_mongo_id', 24);
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('document_versions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('document_id').notNullable().references('documents.id').onDelete('CASCADE');
    t.integer('version').notNullable();
    t.string('status', 50).notNullable();
    t.string('blob_path', 512);
    t.datetime('created_at').defaultTo(knex.fn.now());

    t.unique(['document_id', 'version'], 'uq_document_version');
  });

  await knex.schema.createTable('loans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('borrower_id').references('users.id').onDelete('SET NULL');
    t.decimal('amount', 18, 2);
    t.string('product_type', 50);
    t.integer('term_months');
    t.string('purpose', 50);
    t.decimal('ltv', 5, 2);
    t.integer('credit_score');
    t.string('status', 50);
    t.string('legacy_mongo_id', 24);
    t.datetime('created_at').defaultTo(knex.fn.now());
    t.datetime('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('loan_milestones', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('loan_id').notNullable().references('loans.id').onDelete('CASCADE');
    t.string('name', 100).notNullable();
    t.string('status', 50).notNullable();
    t.datetime('due_at');
    t.datetime('completed_at');
    t.datetime('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('loan_adjustments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    t.uuid('loan_id').notNullable().references('loans.id').onDelete('CASCADE');
    t.string('type', 50);
    t.decimal('value', 9, 4);
    t.string('notes', 500);
    t.datetime('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('loan_adjustments');
  await knex.schema.dropTableIfExists('loan_milestones');
  await knex.schema.dropTableIfExists('loans');
  await knex.schema.dropTableIfExists('document_versions');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
};
