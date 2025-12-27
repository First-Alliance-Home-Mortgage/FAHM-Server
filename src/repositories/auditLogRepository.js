const { getKnex } = require('../db/mssql');

const TABLE = 'audit_logs';

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    ip: row.ip,
    userAgent: row.user_agent,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insert(entry) {
  const knex = getKnex();
  const [row] = await knex(TABLE)
    .insert({
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      status: entry.status || 'success',
      ip: entry.ip,
      user_agent: entry.userAgent,
      metadata_json: entry.metadata ? JSON.stringify(entry.metadata) : null,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
    .returning('*');
  return mapAudit(row);
}

module.exports = {
  insert,
  mapAudit,
};
