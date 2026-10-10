const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid or expired authentication' });
    }

    const userId = decoded.sub || decoded.id;
    const user = db.findById('users', userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired authentication' });
    }

    // Determine Workspace Context & Per-Company Role
    const requestedCompanyId = req.headers['x-company-id'];
    let member = null;
    let targetCompanyId = null;

    if (requestedCompanyId) {
      member = db.findOne('workspaceMembers', m => m.userId === user.id && m.companyId === requestedCompanyId);
      if (member) {
        targetCompanyId = requestedCompanyId;
      }
    }

    if (!targetCompanyId && user.activeCompanyId) {
      member = db.findOne('workspaceMembers', m => m.userId === user.id && m.companyId === user.activeCompanyId);
      if (member) {
        targetCompanyId = user.activeCompanyId;
      }
    }

    if (!targetCompanyId) {
      member = db.findOne('workspaceMembers', m => m.userId === user.id);
      if (member) {
        targetCompanyId = member.companyId;
      }
    }

    const company = targetCompanyId ? db.findById('companies', targetCompanyId) : null;
    const perCompanyRole = member ? member.role : user.role || 'EMPLOYEE';

    const { passwordHash, ...userWithoutPassword } = user;
    req.user = {
      ...userWithoutPassword,
      companyId: targetCompanyId || null,
      role: perCompanyRole,
      globalRole: user.role,
      company: company ? { id: company.id, name: company.name, slug: company.slug } : null
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }
}

module.exports = { authenticate, authRateLimiter };
