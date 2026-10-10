const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { buildUserPayload } = require('../services/authService');
const activityLogger = require('../services/activityLogger');

const router = express.Router();

router.use(authenticate);

// Get authenticated user's workspace memberships
router.get('/my-workspaces', (req, res) => {
  const memberships = db.find('workspaceMembers', m => m.userId === req.user.id);
  const workspaces = memberships.map(m => {
    const company = db.findById('companies', m.companyId);
    return company ? {
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: m.role,
      joinedAt: m.joinedAt
    } : null;
  }).filter(Boolean);

  res.json(workspaces);
});

// Get members of current active workspace
router.get('/members', (req, res) => {
  if (!req.user.companyId) {
    return res.status(403).json({ error: 'Active workspace context required.' });
  }

  const members = db.find('workspaceMembers', m => m.companyId === req.user.companyId);
  const users = db.find('users');
  const teams = db.find('teams');

  const enriched = members.map(m => {
    const u = users.find(usr => usr.id === m.userId);
    if (!u) return null;
    const team = u.teamId ? teams.find(t => t.id === u.teamId) : null;
    const { passwordHash, ...userClean } = u;
    return {
      ...userClean,
      workspaceRole: m.role,
      joinedAt: m.joinedAt,
      team
    };
  }).filter(Boolean);

  res.json(enriched);
});

// Create a new Workspace (User becomes MANAGER)
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Workspace name is required.' });
  }

  const companyId = `comp-${uuidv4().slice(0, 8)}`;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `company-${uuidv4().slice(0, 4)}`;

  const company = db.insert('companies', {
    id: companyId,
    name: name.trim(),
    slug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const member = db.insert('workspaceMembers', {
    id: `wm-${req.user.id}-${companyId}`,
    userId: req.user.id,
    companyId,
    role: 'MANAGER',
    joinedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const updatedUser = db.update('users', req.user.id, {
    activeCompanyId: companyId,
    role: 'MANAGER'
  });

  activityLogger.logActivity(req.user.id, 'WORKSPACE_CREATED', `Created workspace "${name.trim()}"`, 'MANAGER', companyId);

  res.status(201).json({
    message: 'Workspace created successfully',
    company,
    member,
    user: buildUserPayload(updatedUser)
  });
});

// Switch active workspace
router.post('/switch', (req, res) => {
  const { companyId } = req.body;
  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required.' });
  }

  const member = db.findOne('workspaceMembers', m => m.userId === req.user.id && m.companyId === companyId);
  if (!member) {
    return res.status(403).json({ error: 'Forbidden. You are not a member of this workspace.' });
  }

  const updatedUser = db.update('users', req.user.id, {
    activeCompanyId: companyId,
    role: member.role
  });

  res.json({
    message: 'Workspace switched successfully',
    user: buildUserPayload(updatedUser)
  });
});

// Create Invitation (MANAGER ONLY)
router.post('/invite', requireRole('MANAGER'), (req, res) => {
  const { email, role } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Valid invitee email address is required.' });
  }

  const targetRole = (role && ['MANAGER', 'LEADER', 'EMPLOYEE'].includes(role)) ? role : 'EMPLOYEE';
  const token = `inv-${uuidv4()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const invitation = db.insert('invitations', {
    id: `inv-${uuidv4().slice(0, 8)}`,
    companyId: req.user.companyId,
    email: email.trim().toLowerCase(),
    role: targetRole,
    token,
    invitedById: req.user.id,
    expiresAt,
    usedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  activityLogger.logActivity(req.user.id, 'INVITATION_CREATED', `Invited ${email.trim()} as ${targetRole}`, req.user.role, req.user.companyId);

  res.status(201).json({
    message: 'Invitation generated successfully.',
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt
    }
  });
});

// Join Workspace using Invitation Token
router.post('/join', (req, res) => {
  const { invitationToken } = req.body;

  if (!invitationToken) {
    return res.status(400).json({ error: 'invitationToken is required.' });
  }

  const invitation = db.findOne('invitations', i => i.token === invitationToken);
  if (!invitation || invitation.usedAt || new Date(invitation.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired invitation token.' });
  }

  // Check if already a member
  const existingMember = db.findOne('workspaceMembers', m => m.userId === req.user.id && m.companyId === invitation.companyId);
  if (existingMember) {
    return res.status(400).json({ error: 'You are already a member of this workspace.' });
  }

  const member = db.insert('workspaceMembers', {
    id: `wm-${req.user.id}-${invitation.companyId}`,
    userId: req.user.id,
    companyId: invitation.companyId,
    role: invitation.role,
    joinedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  db.update('invitations', invitation.id, {
    usedAt: new Date().toISOString()
  });

  const updatedUser = db.update('users', req.user.id, {
    activeCompanyId: invitation.companyId,
    role: invitation.role
  });

  activityLogger.logActivity(req.user.id, 'WORKSPACE_JOINED', `Joined workspace via invitation`, invitation.role, invitation.companyId);

  res.json({
    message: 'Joined workspace successfully!',
    member,
    user: buildUserPayload(updatedUser)
  });
});

module.exports = router;
