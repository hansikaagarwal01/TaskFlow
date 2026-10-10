const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get Analytics Overview
router.get('/overview', (req, res) => {
  if (!req.user.companyId) {
    return res.json({
      metrics: { totalTasks: 0, pendingTasks: 0, inProgressTasks: 0, completedTasks: 0, pendingApprovals: 0, overdueTasks: 0, completionRate: 0 },
      priorityBreakdown: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      teamPerformance: []
    });
  }

  const companyMembers = db.find('workspaceMembers', m => m.companyId === req.user.companyId);
  const memberUserIds = companyMembers.map(m => m.userId);

  let tasks = db.find('tasks', t => t.companyId === req.user.companyId);
  let users = db.find('users', u => memberUserIds.includes(u.id));
  let teams = db.find('teams', t => t.companyId === req.user.companyId);

  if (req.user.role === 'LEADER') {
    tasks = tasks.filter(t => t.teamId === req.user.teamId);
    users = users.filter(u => u.teamId === req.user.teamId);
  } else if (req.user.role === 'EMPLOYEE') {
    tasks = tasks.filter(t => t.assignedTo === req.user.id);
  }

  const today = new Date();

  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => t.status === 'PENDING').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingApprovals = tasks.filter(t => t.approvalStatus === 'PENDING_APPROVAL').length;
  const overdueTasks = tasks.filter(t => t.status !== 'COMPLETED' && new Date(t.dueDate) < today).length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const priorityBreakdown = {
    HIGH: tasks.filter(t => t.priority === 'HIGH').length,
    MEDIUM: tasks.filter(t => t.priority === 'MEDIUM').length,
    LOW: tasks.filter(t => t.priority === 'LOW').length
  };

  let teamPerformance = [];
  if (req.user.role === 'MANAGER') {
    teamPerformance = teams.map(team => {
      const teamTaskList = db.find('tasks', t => t.teamId === team.id && t.companyId === req.user.companyId);
      const done = teamTaskList.filter(t => t.status === 'COMPLETED').length;
      const total = teamTaskList.length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        totalTasks: total,
        completedTasks: done,
        completionRate: rate
      };
    });
  }

  res.json({
    metrics: {
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      pendingApprovals,
      overdueTasks,
      completionRate
    },
    priorityBreakdown,
    teamPerformance
  });
});

module.exports = router;
