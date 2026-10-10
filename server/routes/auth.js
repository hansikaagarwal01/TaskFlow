const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db/database');
const { hashPassword, verifyPassword } = require('../utils/password');
const { loginSchema, registerSchema, demoLoginSchema, validateRequest } = require('../utils/validation');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  hashRefreshToken, 
  createSession, 
  rotateSession,
  revokeAllUserSessions,
  buildUserPayload
} = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const activityLogger = require('../services/activityLogger');

const router = express.Router();

/**
 * POST /api/auth/register
 * Public registration for TaskFlow ID
 * Supports:
 * 1. Creating a new workspace (becomes MANAGER)
 * 2. Joining an existing workspace via invitation token
 * 3. Creating an unassigned TaskFlow ID (role EMPLOYEE, teamId null, companyId null)
 */
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  const { name, email, password, companyName, invitationToken } = req.validatedBody;
  const normalizedEmail = email.toLowerCase().trim();

  // Check for duplicate email
  const existingUser = db.findOne('users', u => u.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  // Validate Invitation Token if supplied
  let invitation = null;
  if (invitationToken) {
    invitation = db.findOne('invitations', i => i.token === invitationToken);
    if (!invitation || invitation.usedAt || new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation token.' });
    }
  }

  // Hash password with Argon2id
  const passwordHash = await hashPassword(password);

  // Generate unique user ID
  const newUserId = `u-user-${uuidv4().slice(0, 8)}`;

  let initialRole = 'EMPLOYEE';
  let activeCompanyId = null;

  if (companyName && companyName.trim()) {
    // Option A: Create new Company & become MANAGER
    const companyId = `comp-${uuidv4().slice(0, 8)}`;
    const slug = companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `company-${uuidv4().slice(0, 4)}`;

    db.insert('companies', {
      id: companyId,
      name: companyName.trim(),
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    initialRole = 'MANAGER';
    activeCompanyId = companyId;

    db.insert('workspaceMembers', {
      id: `wm-${newUserId}-${companyId}`,
      userId: newUserId,
      companyId,
      role: 'MANAGER',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } else if (invitation) {
    // Option B: Join Workspace via Invitation Token
    initialRole = invitation.role;
    activeCompanyId = invitation.companyId;

    db.insert('workspaceMembers', {
      id: `wm-${newUserId}-${invitation.companyId}`,
      userId: newUserId,
      companyId: invitation.companyId,
      role: invitation.role,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Mark invitation as used
    db.update('invitations', invitation.id, {
      usedAt: new Date().toISOString()
    });
  }

  const newUser = {
    id: newUserId,
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    role: initialRole,
    teamId: null,
    activeCompanyId,
    title: initialRole === 'MANAGER' ? 'Company Manager' : 'Software Employee',
    avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('users', newUser);

  // Create session & tokens for immediate login
  const accessToken = generateAccessToken(newUser);
  const rawRefreshToken = generateRefreshToken();
  createSession(newUser.id, rawRefreshToken, req);

  res.cookie(config.AUTH_REFRESH_COOKIE, rawRefreshToken, config.cookieConfig);

  activityLogger.logActivity(newUser.id, 'USER_REGISTER', `New user ${newUser.name} created an account`, newUser.role, activeCompanyId);

  res.status(201).json({
    accessToken,
    user: buildUserPayload(newUser)
  });
});

/**
 * POST /api/auth/login
 */
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  const { email, password } = req.validatedBody;

  const user = db.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  createSession(user.id, rawRefreshToken, req);

  res.cookie(config.AUTH_REFRESH_COOKIE, rawRefreshToken, config.cookieConfig);

  activityLogger.logActivity(user.id, 'USER_LOGIN', `User ${user.name} logged in successfully`, user.role, user.activeCompanyId);

  res.json({
    accessToken,
    user: buildUserPayload(user)
  });
});

/**
 * POST /api/auth/demo-login
 */
router.post('/demo-login', validateRequest(demoLoginSchema), (req, res) => {
  const { userId } = req.validatedBody;

  const user = db.findById('users', userId);
  if (!user) {
    return res.status(404).json({ error: 'Demo user not found.' });
  }

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();
  createSession(user.id, rawRefreshToken, req);

  res.cookie(config.AUTH_REFRESH_COOKIE, rawRefreshToken, config.cookieConfig);

  activityLogger.logActivity(user.id, 'DEMO_LOGIN', `Demo user ${user.name} logged in (${user.role})`, user.role, user.activeCompanyId);

  res.json({
    accessToken,
    user: buildUserPayload(user)
  });
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', (req, res) => {
  const rawRefreshToken = req.cookies[config.AUTH_REFRESH_COOKIE];

  if (!rawRefreshToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const presentedHash = hashRefreshToken(rawRefreshToken);
  const session = db.findOne('sessions', s => s.tokenHash === presentedHash);

  if (!session) {
    res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }

  if (session.revokedAt) {
    revokeAllUserSessions(session.userId);
    res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }

  if (new Date(session.expiresAt) < new Date()) {
    db.update('sessions', session.id, { revokedAt: new Date().toISOString() });
    res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }

  const user = db.findById('users', session.userId);
  if (!user) {
    db.update('sessions', session.id, { revokedAt: new Date().toISOString() });
    res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }

  const { newRawRefreshToken } = rotateSession(session, req);
  const newAccessToken = generateAccessToken(user);

  res.cookie(config.AUTH_REFRESH_COOKIE, newRawRefreshToken, config.cookieConfig);

  res.json({
    accessToken: newAccessToken,
    user: buildUserPayload(user)
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const rawRefreshToken = req.cookies[config.AUTH_REFRESH_COOKIE];

  if (rawRefreshToken) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = db.findOne('sessions', s => s.tokenHash === tokenHash);
    if (session && !session.revokedAt) {
      db.update('sessions', session.id, { revokedAt: new Date().toISOString() });
      if (session.userId) {
        activityLogger.logActivity(session.userId, 'USER_LOGOUT', 'User logged out', 'USER');
      }
    }
  }

  res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/logout-all
 */
router.post('/logout-all', authenticate, (req, res) => {
  revokeAllUserSessions(req.user.id);
  res.clearCookie(config.AUTH_REFRESH_COOKIE, config.cookieConfig);
  activityLogger.logActivity(req.user.id, 'USER_LOGOUT_ALL', 'User logged out of all active sessions', req.user.role, req.user.companyId);
  res.json({ message: 'Logged out of all sessions successfully' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, (req, res) => {
  const user = db.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({
    user: buildUserPayload(user)
  });
});

/**
 * GET /api/auth/sessions
 */
router.get('/sessions', authenticate, (req, res) => {
  const rawRefreshToken = req.cookies[config.AUTH_REFRESH_COOKIE];
  const currentTokenHash = rawRefreshToken ? hashRefreshToken(rawRefreshToken) : null;

  const userSessions = db.find('sessions', s => s.userId === req.user.id && !s.revokedAt);

  const safeSessions = userSessions.map(s => ({
    id: s.id,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    expiresAt: s.expiresAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    current: s.tokenHash === currentTokenHash
  }));

  res.json(safeSessions);
});

/**
 * DELETE /api/auth/sessions/:id
 */
router.delete('/sessions/:id', authenticate, (req, res) => {
  const sessionId = req.params.id;
  const session = db.findById('sessions', sessionId);

  if (!session || session.revokedAt) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  if (session.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden. You can only revoke your own sessions.' });
  }

  db.update('sessions', session.id, { revokedAt: new Date().toISOString() });
  res.json({ message: 'Session revoked successfully' });
});

module.exports = router;
