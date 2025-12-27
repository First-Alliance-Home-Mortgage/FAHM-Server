const crypto = require('crypto');
const { getKnex } = require('../db/mssql');

const TABLE = 'refresh_tokens';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function mapToken(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    replacedBy: row.replaced_by,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isExpired(token) {
  return Boolean(token?.expiresAt && new Date(token.expiresAt).getTime() <= Date.now());
}

function isActive(token) {
  return Boolean(token && !token.revokedAt && !isExpired(token));
}

async function insertToken({ userId, tokenValue, expiresAt, metadata }) {
  const knex = getKnex();
  const [row] = await knex(TABLE)
    .insert({
      user_id: userId,
      token_hash: hashToken(tokenValue),
      expires_at: expiresAt,
      metadata_json: metadata ? JSON.stringify(metadata) : null,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
    .returning('*');
  return { token: tokenValue, entity: mapToken(row) };
}

async function findByTokenValue(tokenValue) {
  if (!tokenValue) return null;
  const knex = getKnex();
  const row = await knex(TABLE)
    .where({ token_hash: hashToken(tokenValue) })
    .first();
  return mapToken(row);
}

async function markRevoked(id, reason, metadata) {
  const knex = getKnex();
  const [row] = await knex(TABLE)
    .where({ id })
    .update({
      revoked_at: knex.fn.now(),
      revoked_reason: reason,
      metadata_json: metadata ? JSON.stringify(metadata) : undefined,
      updated_at: knex.fn.now(),
    })
    .returning('*');
  return mapToken(row);
}

async function setReplacedBy(id, replacedById) {
  const knex = getKnex();
  const [row] = await knex(TABLE)
    .where({ id })
    .update({ replaced_by: replacedById, updated_at: knex.fn.now() })
    .returning('*');
  return mapToken(row);
}

async function revokeAllForUser(userId, reason) {
  if (!userId) return;
  const knex = getKnex();
  await knex(TABLE)
    .where({ user_id: userId })
    .andWhere({ revoked_at: null })
    .update({
      revoked_at: knex.fn.now(),
      revoked_reason: reason,
      updated_at: knex.fn.now(),
    });
}

module.exports = {
  hashToken,
  mapToken,
  isExpired,
  isActive,
  insertToken,
  findByTokenValue,
  markRevoked,
  setReplacedBy,
  revokeAllForUser,
};
