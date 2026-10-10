const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/activity - Global/Scoped Activity Feed
router.get('/', (req, res) => {
  if (!req.user.companyId) {
    return res.json(req.query.page || req.query.limit || req.query.pageSize ? { activities: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } } : []);
  }

  const isPaginatedReq = req.query.page !== undefined || req.query.limit !== undefined || req.query.pageSize !== undefined;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const rawLimit = parseInt(req.query.limit || req.query.pageSize || '20', 10);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));

  if (req.query.page !== undefined && (isNaN(parseInt(req.query.page, 10)) || parseInt(req.query.page, 10) < 1)) {
    return res.status(400).json({ error: 'Invalid page number. Page must be an integer >= 1.' });
  }

  let logs = db.find('activityLogs', l => l.companyId === req.user.companyId);
  const users = db.find('users');
  const tasks = db.find('tasks');

  // Enforce Role Scope
  if (req.user.role === 'LEADER') {
    const teamUserIds = users.filter(u => u.teamId === req.user.teamId).map(u => u.id);
    logs = logs.filter(l => teamUserIds.includes(l.userId) || (l.taskId && db.findById('tasks', l.taskId)?.teamId === req.user.teamId));
  } else if (req.user.role === 'EMPLOYEE') {
    logs = logs.filter(l => l.userId === req.user.id || (l.taskId && db.findById('tasks', l.taskId)?.assignedTo === req.user.id));
  }

  const enrichedLogs = logs.map(log => {
    const user = users.find(u => u.id === log.userId);
    const task = log.taskId ? tasks.find(t => t.id === log.taskId) : null;

    return {
      ...log,
      userName: user ? user.name : 'System User',
      userAvatar: user ? user.avatar : null,
      userRole: user ? user.role : 'SYSTEM',
      taskTitle: task ? task.title : null
    };
  });

  enrichedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = enrichedLogs.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = enrichedLogs.slice((page - 1) * limit, page * limit);

  if (isPaginatedReq) {
    return res.json({
      activities: paginated,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages
      }
    });
  }

  res.json(paginated);
});

module.exports = router;
