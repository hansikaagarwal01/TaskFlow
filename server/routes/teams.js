const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireWorkspace } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

// Get teams list (MANAGER sees all in company, Leader/Employee sees only their assigned team)
router.get('/', (req, res) => {
  if (!req.user.companyId) return res.json([]);

  const teams = db.find('teams', t => t.companyId === req.user.companyId);
  const companyMembers = db.find('workspaceMembers', m => m.companyId === req.user.companyId);
  const companyUserIds = companyMembers.map(m => m.userId);
  const users = db.find('users', u => companyUserIds.includes(u.id));

  const enrichedTeams = teams.map(team => {
    const leader = users.find(u => u.id === team.leaderId);
    const members = users.filter(u => u.teamId === team.id);
    const teamTasks = db.find('tasks', t => t.teamId === team.id && t.companyId === req.user.companyId);

    return {
      ...team,
      leader: leader ? { id: leader.id, name: leader.name, email: leader.email, avatar: leader.avatar, title: leader.title } : null,
      membersCount: members.length,
      members: members.map(({ passwordHash, ...m }) => m),
      totalTasks: teamTasks.length,
      activeTasks: teamTasks.filter(t => t.status !== 'COMPLETED').length
    };
  });

  if (req.user.role === 'MANAGER') {
    return res.json(enrichedTeams);
  }

  const myTeam = enrichedTeams.find(t => t.id === req.user.teamId);
  res.json(myTeam ? [myTeam] : []);
});

// Get team by ID
router.get('/:id', (req, res) => {
  const teamId = req.params.id;
  const team = db.findById('teams', teamId);

  if (!team || (req.user.companyId && team.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  if (req.user.role !== 'MANAGER' && req.user.teamId !== teamId) {
    return res.status(403).json({ error: 'Forbidden. You do not have permission to access this team.' });
  }

  const companyMembers = db.find('workspaceMembers', m => m.companyId === req.user.companyId);
  const companyUserIds = companyMembers.map(m => m.userId);
  const users = db.find('users', u => companyUserIds.includes(u.id));

  const leader = users.find(u => u.id === team.leaderId);
  const members = users.filter(u => u.teamId === team.id);
  const tasks = db.find('tasks', t => t.teamId === team.id && t.companyId === req.user.companyId);

  res.json({
    ...team,
    leader: leader ? { id: leader.id, name: leader.name, email: leader.email, avatar: leader.avatar, title: leader.title } : null,
    members: members.map(({ passwordHash, ...m }) => m),
    tasks
  });
});

// Create Team (MANAGER ONLY)
router.post('/', requireWorkspace, requireRole('MANAGER'), (req, res) => {
  const { name, description, leaderId } = req.body;

  if (!name || !leaderId) {
    return res.status(400).json({ error: 'Team name and leaderId are required.' });
  }

  const leaderUser = db.findById('users', leaderId);
  if (!leaderUser) {
    return res.status(404).json({ error: 'Assigned leader user does not exist.' });
  }

  const leaderMember = db.findOne('workspaceMembers', m => m.userId === leaderId && m.companyId === req.user.companyId);
  if (!leaderMember) {
    return res.status(400).json({ error: 'Assigned leader user does not belong to your company.' });
  }

  const teamId = `team-${uuidv4().slice(0, 8)}`;
  const newTeam = db.insert('teams', {
    id: teamId,
    companyId: req.user.companyId,
    name: name.trim(),
    description: description ? description.trim() : '',
    leaderId,
    createdAt: new Date().toISOString()
  });

  if (leaderUser.role !== 'MANAGER') {
    db.update('users', leaderId, {
      role: 'LEADER',
      teamId: newTeam.id
    });

    db.update('workspaceMembers', leaderMember.id, {
      role: 'LEADER'
    });
  } else {
    db.update('users', leaderId, {
      teamId: newTeam.id
    });
  }

  res.status(201).json({
    message: 'Team created successfully',
    team: newTeam
  });
});

// Edit Team (MANAGER ONLY)
router.put('/:id', requireWorkspace, requireRole('MANAGER'), (req, res) => {
  const teamId = req.params.id;
  const { name, description, leaderId } = req.body;

  const existingTeam = db.findById('teams', teamId);
  if (!existingTeam || (req.user.companyId && existingTeam.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  const updates = {};
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();

  if (leaderId && leaderId !== existingTeam.leaderId) {
    const leaderUser = db.findById('users', leaderId);
    if (!leaderUser) {
      return res.status(404).json({ error: 'Selected leader user does not exist.' });
    }
    const leaderMember = db.findOne('workspaceMembers', m => m.userId === leaderId && m.companyId === req.user.companyId);
    if (!leaderMember) {
      return res.status(400).json({ error: 'Selected leader user does not belong to your company.' });
    }
    const oldLeaderId = existingTeam.leaderId;
    if (oldLeaderId && oldLeaderId !== leaderId) {
      const oldLeaderUser = db.findById('users', oldLeaderId);
      const otherTeamsLed = db.find('teams', t => t.companyId === req.user.companyId && t.leaderId === oldLeaderId && t.id !== teamId);
      if (oldLeaderUser && oldLeaderUser.role === 'LEADER' && otherTeamsLed.length === 0) {
        db.update('users', oldLeaderId, { role: 'EMPLOYEE' });
        const oldLeaderWm = db.findOne('workspaceMembers', m => m.userId === oldLeaderId && m.companyId === req.user.companyId);
        if (oldLeaderWm) {
          db.update('workspaceMembers', oldLeaderWm.id, { role: 'EMPLOYEE' });
        }
      }
    }

    updates.leaderId = leaderId;
    if (leaderUser.role !== 'MANAGER') {
      db.update('users', leaderId, { role: 'LEADER', teamId });
      db.update('workspaceMembers', leaderMember.id, { role: 'LEADER' });
    } else {
      db.update('users', leaderId, { teamId });
    }
  }

  const updatedTeam = db.update('teams', teamId, updates);
  res.json({ message: 'Team updated successfully', team: updatedTeam });
});

// Delete Team (MANAGER ONLY)
router.delete('/:id', requireWorkspace, requireRole('MANAGER'), (req, res) => {
  const teamId = req.params.id;
  const team = db.findById('teams', teamId);

  if (!team || (req.user.companyId && team.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  const members = db.find('users', u => u.teamId === teamId);
  members.forEach(member => {
    db.update('users', member.id, {
      teamId: null,
      role: member.role === 'LEADER' ? 'EMPLOYEE' : member.role
    });
  });

  db.delete('teams', teamId);
  res.json({ message: 'Team deleted successfully.' });
});

module.exports = router;
