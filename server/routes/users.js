const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireManager, requireWorkspace } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

// Get users list (scoped to active company workspace)
router.get('/', (req, res) => {
  if (!req.user.companyId) return res.json([]);

  const companyMembers = db.find('workspaceMembers', m => m.companyId === req.user.companyId);
  const companyUserIds = companyMembers.map(m => m.userId);

  let users = db.find('users', u => companyUserIds.includes(u.id));

  // Strip password hashes & enrich with company role
  users = users.map(({ passwordHash, ...user }) => {
    const member = companyMembers.find(m => m.userId === user.id);
    const team = user.teamId ? db.findById('teams', user.teamId) : null;
    return {
      ...user,
      role: member ? member.role : user.role,
      team
    };
  });

  if (req.user.role === 'MANAGER') {
    return res.json(users);
  }

  // Leaders and Employees can only view users in their team + manager
  const teamUsers = users.filter(
    u => u.role === 'MANAGER' || (u.teamId && u.teamId === req.user.teamId)
  );

  res.json(teamUsers);
});

// Update user team assignment or role (MANAGER ONLY)
router.put('/:id/team', requireWorkspace, requireManager, (req, res) => {
  const { id } = req.params;
  const { teamId, role, title } = req.body;

  const targetUser = db.findById('users', id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const targetMember = db.findOne('workspaceMembers', m => m.userId === id && m.companyId === req.user.companyId);
  if (!targetMember) {
    return res.status(404).json({ error: 'Target user does not belong to your company workspace.' });
  }

  if (teamId) {
    const team = db.findById('teams', teamId);
    if (!team || team.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Target team does not exist in your company.' });
    }
  }

  const userUpdates = {};
  if (teamId !== undefined) userUpdates.teamId = teamId;
  if (role !== undefined) userUpdates.role = role;
  if (title !== undefined) userUpdates.title = title;

  const updatedUser = db.update('users', id, userUpdates);

  if (role !== undefined) {
    db.update('workspaceMembers', targetMember.id, { role });
  }

  const { passwordHash, ...userWithoutPassword } = updatedUser;

  res.json({
    message: 'User updated successfully',
    user: {
      ...userWithoutPassword,
      role: role || targetMember.role
    }
  });
});

module.exports = router;
