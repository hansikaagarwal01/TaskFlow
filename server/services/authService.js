const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db/database');

function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    companyId: user.activeCompanyId || null,
    type: 'access'
  };

  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function createSession(userId, rawRefreshToken, req) {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.REFRESH_TOKEN_EXPIRES_MS).toISOString();

  const session = {
    id: `sess-${uuidv4()}`,
    userId,
    tokenHash,
    expiresAt,
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    revokedAt: null,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown'
  };

  return db.insert('sessions', session);
}

function rotateSession(oldSession, req) {
  db.update('sessions', oldSession.id, {
    revokedAt: new Date().toISOString()
  });

  const newRawRefreshToken = generateRefreshToken();
  const newSession = createSession(oldSession.userId, newRawRefreshToken, req);

  return {
    newRawRefreshToken,
    newSession
  };
}

function revokeAllUserSessions(userId) {
  const userSessions = db.find('sessions', s => s.userId === userId && !s.revokedAt);
  const now = new Date().toISOString();
  userSessions.forEach(s => {
    db.update('sessions', s.id, { revokedAt: now });
  });
  return userSessions.length;
}

function buildUserPayload(user) {
  const { passwordHash, ...userWithoutPassword } = user;
  
  let companyId = user.activeCompanyId;
  let member = companyId 
    ? db.findOne('workspaceMembers', m => m.userId === user.id && m.companyId === companyId)
    : db.findOne('workspaceMembers', m => m.userId === user.id);

  if (!member && !companyId) {
    companyId = null;
  } else if (member) {
    companyId = member.companyId;
  }

  const company = companyId ? db.findById('companies', companyId) : null;
  const role = member ? member.role : user.role || 'EMPLOYEE';
  const team = user.teamId ? db.findById('teams', user.teamId) : null;

  const userMemberships = db.find('workspaceMembers', m => m.userId === user.id);
  const userCompanies = userMemberships.map(m => {
    const c = db.findById('companies', m.companyId);
    return c ? { id: c.id, name: c.name, slug: c.slug, role: m.role } : null;
  }).filter(Boolean);

  return {
    ...userWithoutPassword,
    companyId,
    role,
    team,
    company: company ? { id: company.id, name: company.name, slug: company.slug } : null,
    companies: userCompanies
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  createSession,
  rotateSession,
  revokeAllUserSessions,
  buildUserPayload
};
