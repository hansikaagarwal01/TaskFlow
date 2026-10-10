const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireManager, requireWorkspace } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLogger');

const router = express.Router();

router.use(authenticate);

// Get Pending Approvals
router.get('/', requireRole('MANAGER', 'LEADER'), (req, res) => {
  if (!req.user.companyId) return res.json([]);

  let tasks = db.find('tasks', t => t.companyId === req.user.companyId && t.approvalStatus === 'PENDING_APPROVAL');

  if (req.user.role === 'LEADER') {
    tasks = tasks.filter(t => t.teamId === req.user.teamId);
  }

  const users = db.find('users');
  const teams = db.find('teams');

  const enriched = tasks.map(task => {
    const creator = users.find(u => u.id === task.createdBy);
    const assignee = users.find(u => u.id === task.assignedTo);
    const team = teams.find(t => t.id === task.teamId);

    return {
      ...task,
      creatorName: creator ? creator.name : 'Unknown',
      creatorAvatar: creator ? creator.avatar : null,
      assigneeName: assignee ? assignee.name : 'Unassigned',
      teamName: team ? team.name : 'General'
    };
  });

  res.json(enriched);
});

// Manager Approves Task (MANAGER ONLY)
router.post('/:id/approve', requireWorkspace, requireManager, (req, res) => {
  const taskId = req.params.id;
  const task = db.findById('tasks', taskId);

  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (task.approvalStatus !== 'PENDING_APPROVAL') {
    return res.status(400).json({ error: `Task is not pending approval (Current status: ${task.approvalStatus}).` });
  }

  const updatedTask = db.update('tasks', taskId, {
    approvalStatus: 'APPROVED',
    status: 'PENDING',
    rejectionReason: null,
    updatedAt: new Date().toISOString()
  });

  const assignee = db.findById('users', task.assignedTo);
  const creator = db.findById('users', task.createdBy);

  logActivity({
    companyId: req.user.companyId,
    taskId: task.id,
    userId: req.user.id,
    action: 'APPROVED',
    details: `Manager ${req.user.name} APPROVED task "${task.title}". Task is now active for execution.`,
    notifyUserId: creator ? creator.id : null,
    notificationType: 'TASK_APPROVED',
    notificationTitle: 'Task Approved by Manager',
    notificationMessage: `Your task "${task.title}" was approved by Manager ${req.user.name}.`
  });

  if (assignee && assignee.id !== creator?.id) {
    db.insert('notifications', {
      id: `notif-${Date.now()}`,
      companyId: req.user.companyId,
      userId: assignee.id,
      title: 'New Active Task Available',
      message: `Task "${task.title}" has been approved and is ready for work.`,
      type: 'TASK_ASSIGNED',
      taskId: task.id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  res.json({
    message: 'Task approved successfully. It is now active for the assigned employee.',
    task: updatedTask
  });
});

// Manager Rejects Task (MANAGER ONLY)
router.post('/:id/reject', requireWorkspace, requireManager, (req, res) => {
  const taskId = req.params.id;
  const { rejectionReason } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ error: 'A valid rejection reason must be provided.' });
  }

  const task = db.findById('tasks', taskId);
  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (task.approvalStatus !== 'PENDING_APPROVAL') {
    return res.status(400).json({ error: `Task is not pending approval (Current status: ${task.approvalStatus}).` });
  }

  const updatedTask = db.update('tasks', taskId, {
    approvalStatus: 'REJECTED',
    rejectionReason: rejectionReason.trim(),
    updatedAt: new Date().toISOString()
  });

  const creator = db.findById('users', task.createdBy);

  logActivity({
    companyId: req.user.companyId,
    taskId: task.id,
    userId: req.user.id,
    action: 'REJECTED',
    details: `Manager ${req.user.name} REJECTED task "${task.title}". Reason: ${rejectionReason}`,
    notifyUserId: creator ? creator.id : null,
    notificationType: 'TASK_REJECTED',
    notificationTitle: 'Task Revision Required',
    notificationMessage: `Manager ${req.user.name} rejected task "${task.title}". Feedback: ${rejectionReason}`
  });

  res.json({
    message: 'Task rejected with feedback provided to leader.',
    task: updatedTask
  });
});

module.exports = router;
