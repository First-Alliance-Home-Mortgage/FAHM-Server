const bcrypt = require('bcryptjs');
const { getKnex } = require('../db/mssql');

const TABLE = 'users';

function mapUser(row, { includePassword } = {}) {
  if (!row) return null;
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    azureAdB2CId: row.azure_ad_b2c_id,
    emailVerified: Boolean(row.email_verified),
    isActive: Boolean(row.is_active),
    nmls: row.nmls,
    title: row.title,
    photo: row.photo,
    branch: {
      name: row.branch_name,
      address: row.branch_address,
      city: row.branch_city,
      state: row.branch_state,
      zip: row.branch_zip,
      phone: row.branch_phone,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    legacyMongoId: row.legacy_mongo_id,
  };
  if (!includePassword) {
    return user;
  }
  return { ...user, passwordHash: row.password_hash };
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function create(user) {
  const knex = getKnex();
  const now = knex.fn.now();
  const email = user.email ? user.email.toLowerCase().trim() : undefined;
  const passwordHash = await hashPassword(user.password);

  const [row] = await knex(TABLE)
    .insert({
      name: user.name,
      email,
      password_hash: passwordHash,
      role: user.role,
      phone: user.phone,
      azure_ad_b2c_id: user.azureAdB2CId,
      email_verified: user.emailVerified ?? false,
      is_active: user.isActive ?? true,
      nmls: user.nmls,
      title: user.title,
      photo: user.photo,
      branch_name: user.branch?.name,
      branch_address: user.branch?.address,
      branch_city: user.branch?.city,
      branch_state: user.branch?.state,
      branch_zip: user.branch?.zip,
      branch_phone: user.branch?.phone,
      legacy_mongo_id: user.legacyMongoId,
      created_at: now,
      updated_at: now,
    })
    .returning('*');

  return mapUser(row);
}

async function findByEmail(email, { includePassword = false } = {}) {
  if (!email) return null;
  const knex = getKnex();
  const row = await knex(TABLE)
    .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
    .first();
  return mapUser(row, { includePassword });
}

async function findById(id, { includePassword = false } = {}) {
  if (!id) return null;
  const knex = getKnex();
  const row = await knex(TABLE).where({ id }).first();
  return mapUser(row, { includePassword });
}

async function setPassword(id, newPassword) {
  if (!id || !newPassword) return null;
  const knex = getKnex();
  const passwordHash = await hashPassword(newPassword);
  const [row] = await knex(TABLE)
    .where({ id })
    .update({ password_hash: passwordHash, updated_at: knex.fn.now() })
    .returning('*');
  return mapUser(row);
}

function comparePassword(candidate, passwordHash) {
  return bcrypt.compare(candidate, passwordHash);
}

module.exports = {
  create,
  findByEmail,
  findById,
  setPassword,
  comparePassword,
};
