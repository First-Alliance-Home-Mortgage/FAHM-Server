const crypto = require('crypto');
const createError = require('http-errors');
const RefreshToken = require('../models/RefreshToken');
const { refreshTokenExpiryDays } = require('../config/env');

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const generateTokenValue = () => crypto.randomBytes(40).toString('hex');
const computeExpiryDate = () => new Date(Date.now() + refreshTokenExpiryDays * MILLISECONDS_PER_DAY);

async function createToken({ userId, metadata }) {
  const tokenValue = generateTokenValue();
  const expiresAt = computeExpiryDate();

  const doc = await RefreshToken.create({
    user: userId,
    tokenHash: RefreshToken.hashToken(tokenValue),
    expiresAt,
    metadata,
  });
  return { token: tokenValue, doc };
}

async function findActiveToken(tokenValue) {
  if (!tokenValue) return null;
  const tokenHash = RefreshToken.hashToken(tokenValue);
  const doc = await RefreshToken.findOne({ tokenHash });
  if (!doc || !doc.isActive()) {
    return null;
  }
  return doc;
}

async function rotateToken({ tokenValue, metadata }) {
  const existing = await findActiveToken(tokenValue);
  if (!existing) {
    throw createError(401, 'Invalid refresh token');
  }

  existing.revokedAt = new Date();
  existing.revokedReason = 'rotated';
  if (metadata) {
    existing.metadata = { ...existing.metadata, ...metadata };
  }
  await existing.save();

  const { token: nextToken, doc: nextDoc } = await createToken({ userId: existing.user, metadata });
  existing.replacedBy = nextDoc._id;
  await existing.save();

  return { userId: existing.user, refreshToken: nextToken };
}

async function revokeToken(tokenValue, reason = 'user_logout', metadata) {
  const existing = await findActiveToken(tokenValue);
  if (!existing) return null;
  existing.revokedAt = new Date();
  existing.revokedReason = reason;
  if (metadata) {
    existing.metadata = { ...existing.metadata, ...metadata };
  }
  await existing.save();
  return existing;
}

async function revokeTokensForUser(userId, reason = 'user_logout_all') {
  if (!userId) return;
  await RefreshToken.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { revokedAt: new Date(), revokedReason: reason }
  );
}

module.exports = {
  createToken,
  rotateToken,
  revokeToken,
  revokeTokensForUser,
};
