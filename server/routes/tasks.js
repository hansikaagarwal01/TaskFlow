const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, validateTaskAccess, requireWorkspace } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLogger');
const { isValidDateString, isPastDate } = require('../utils/validation');

const router = express.Router();

router.use(authenticate);

function isValidStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;

  const allowedTransitions = {
    PENDING: ['IN_PROGRESS', 'COMPLETED'],
    IN_PROGRESS: ['COMPLETED', 'PENDING'],
    COMPLETED: ['IN_PROGRESS']
  };

  return (allowedTransitions[currentStatus] || []).includes(targetStatus);
}

// List Tasks with Scoped Filtering & Database Pagination
router.get('/', (req, res) => {
  if (!req.user.companyId) {
    return res.json(req.query.page || req.query.limit || req.query.pageSize ? { tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } } : []);
  }

  const { teamId, priority, status, approvalStatus, search, assignedTo } = req.query;

  const isPaginatedReq = req.query.page !== undefined || req.query.limit !== undefined || req.query.pageSize !== undefined;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const rawLimit = parseInt(req.query.limit || req.query.pageSize || '10', 10);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));

  let tasks = db.find('tasks', t => t.companyId === req.user.companyId);

  if (req.user.role === 'LEADER') {
    tasks = tasks.filter(t => t.teamId === req.user.teamId);
  } else if (req.user.role === 'EMPLOYEE') {
    tasks = tasks.filter(t => t.assignedTo === req.user.id);
  } else if (teamId) {
    tasks = tasks.filter(t => t.teamId === teamId);
  }

  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (approvalStatus) tasks = tasks.filter(t => t.approvalStatus === approvalStatus);
  if (assignedTo && req.user.role === 'MANAGER') {
    tasks = tasks.filter(t => t.assignedTo === assignedTo);
  }
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
  }

  const totalCount = tasks.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  tasks.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const paginatedTasks = isPaginatedReq ? tasks.slice((page - 1) * limit, page * limit) : tasks;

  const users = db.find('users');
  const teams = db.find('teams');

  const enrichedTasks = paginatedTasks.map(task => {
    const assignee = users.find(u => u.id === task.assignedTo);
    const creator = users.find(u => u.id === task.createdBy);
    const team = teams.find(t => t.id === task.teamId);

    return {
      ...task,
      assigneeName: assignee ? assignee.name : 'Unassigned',
      assigneeAvatar: assignee ? assignee.avatar : null,
      assigneeTitle: assignee ? assignee.title : '',
      creatorName: creator ? creator.name : 'System',
      creatorRole: creator ? creator.role : '',
      teamName: team ? team.name : 'General'
    };
  });

  if (isPaginatedReq) {
    return res.json({
      tasks: enrichedTasks,
      pagination: {
        page,
        pageSize: limit,
        total: totalCount,
        totalPages
      }
    });
  }

  res.json(enrichedTasks);
});

// Get Single Task by ID
router.get('/:id', (req, res) => {
  const taskId = req.params.id;
  const task = db.findById('tasks', taskId);

  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (req.user.role === 'LEADER' && task.teamId !== req.user.teamId) {
    return res.status(403).json({ error: 'Access denied. You do not have access to tasks outside your team.' });
  }
  if (req.user.role === 'EMPLOYEE' && task.assignedTo !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. You can only view tasks assigned to you.' });
  }

  const assignee = db.findById('users', task.assignedTo);
  const creator = db.findById('users', task.createdBy);
  const team = db.findById('teams', task.teamId);
  const logs = db.find('activityLogs', l => l.taskId === taskId && l.companyId === req.user.companyId);

  res.json({
    ...task,
    assigneeName: assignee ? assignee.name : 'Unassigned',
    assigneeAvatar: assignee ? assignee.avatar : null,
    creatorName: creator ? creator.name : 'System',
    teamName: team ? team.name : 'General',
    activityHistory: logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  });
});

// Create Task (Manager or Leader Only)
router.post('/', requireWorkspace, requireRole('MANAGER', 'LEADER'), (req, res) => {
  const { title, description, priority, assignedTo, teamId, dueDate } = req.body;

  if (!title || !priority || !assignedTo || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields: title, priority, assignedTo, dueDate.' });
  }

  if (!isValidDateString(dueDate)) {
    return res.status(400).json({ error: 'Invalid due date format.' });
  }
  if (isPastDate(dueDate)) {
    return res.status(400).json({ error: 'Due date cannot be in the past.' });
  }

  const assignee = db.findById('users', assignedTo);
  if (!assignee) {
    return res.status(404).json({ error: 'Assigned user does not exist.' });
  }

  const assigneeMember = db.findOne('workspaceMembers', m => m.userId === assignedTo && m.companyId === req.user.companyId);
  if (!assigneeMember) {
    return res.status(400).json({ error: 'Assigned user does not belong to your company.' });
  }

  let targetTeamId;
  let approvalStatus;

  if (req.user.role === 'LEADER') {
    targetTeamId = req.user.teamId;

    if (assignee.teamId !== req.user.teamId) {
      return res.status(403).json({ error: 'Forbidden. Leader can only assign tasks to employees within their own team.' });
    }

    approvalStatus = 'PENDING_APPROVAL';
  } else {
    const companyTeams = db.find('teams', t => t.companyId === req.user.companyId);
    targetTeamId = teamId || assignee.teamId || (companyTeams[0] ? companyTeams[0].id : 'team-eng');

    if (assignee.teamId && assignee.teamId !== targetTeamId) {
      return res.status(400).json({ error: 'Assigned user must belong to the specified team.' });
    }

    approvalStatus = 'NOT_REQUIRED';
  }

  const taskId = `task-${uuidv4().slice(0, 8)}`;
  const newTask = db.insert('tasks', {
    id: taskId,
    companyId: req.user.companyId,
    title: title.trim(),
    description: description ? description.trim() : '',
    priority,
    status: 'PENDING',
    approvalStatus,
    assignedTo,
    teamId: targetTeamId,
    createdBy: req.user.id,
    dueDate,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (approvalStatus === 'PENDING_APPROVAL') {
    const managers = db.find('workspaceMembers', m => m.companyId === req.user.companyId && m.role === 'MANAGER');
    const managerUser = managers.length > 0 ? db.findById('users', managers[0].userId) : null;

    logActivity({
      companyId: req.user.companyId,
      taskId: newTask.id,
      userId: req.user.id,
      action: 'SUBMITTED_FOR_APPROVAL',
      details: `Leader ${req.user.name} created task "${title}" and submitted for Manager approval.`,
      notifyUserId: managerUser ? managerUser.id : null,
      notificationType: 'APPROVAL_REQUEST',
      notificationTitle: 'Task Approval Pending',
      notificationMessage: `${req.user.name} submitted task "${title}" for your approval.`
    });
  } else {
    logActivity({
      companyId: req.user.companyId,
      taskId: newTask.id,
      userId: req.user.id,
      action: 'TASK_CREATED',
      details: `Manager ${req.user.name} created task "${title}" assigned to ${assignee.name}.`,
      notifyUserId: assignee.id,
      notificationType: 'TASK_ASSIGNED',
      notificationTitle: 'New Task Assigned',
      notificationMessage: `You have been assigned to task "${title}". Due date: ${dueDate}`
    });
  }

  res.status(201).json({
    message: approvalStatus === 'PENDING_APPROVAL' 
      ? 'Task created and submitted for Manager approval.' 
      : 'Task created and assigned successfully.',
    task: newTask
  });
});

// Update Task Status
router.put('/:id/status', requireWorkspace, validateTaskAccess('update_status'), (req, res) => {
  const { status } = req.body;
  const task = req.targetTask;

  if (!status || !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be PENDING, IN_PROGRESS, or COMPLETED.' });
  }

  if (task.approvalStatus === 'PENDING_APPROVAL' || task.approvalStatus === 'REJECTED') {
    return res.status(400).json({
      error: `Cannot update status because task approval status is '${task.approvalStatus}'. Approval from Manager is required first.`
    });
  }

  if (!isValidStatusTransition(task.status, status)) {
    return res.status(400).json({
      error: `Invalid status transition from '${task.status}' to '${status}'. Completed tasks cannot be reset directly to pending. Reopen to IN_PROGRESS first.`
    });
  }

  const updatedTask = db.update('tasks', task.id, { 
    status,
    updatedAt: new Date().toISOString()
  });

  logActivity({
    companyId: req.user.companyId,
    taskId: task.id,
    userId: req.user.id,
    action: 'STATUS_CHANGED',
    details: `${req.user.name} updated task status from '${task.status}' to '${status}'.`
  });

  res.json({ message: 'Task status updated successfully', task: updatedTask });
});

// Edit Task / Resubmit (Manager or Leader)
router.put('/:id', requireWorkspace, validateTaskAccess('edit'), (req, res) => {
  const task = req.targetTask;
  const { title, description, priority, assignedTo, dueDate } = req.body;

  if (dueDate && !isValidDateString(dueDate)) {
    return res.status(400).json({ error: 'Invalid due date format.' });
  }

  const updates = {
    updatedAt: new Date().toISOString()
  };

  if (title) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (priority) updates.priority = priority;
  if (dueDate) updates.dueDate = dueDate;

  if (assignedTo) {
    const assignee = db.findById('users', assignedTo);
    if (!assignee) {
      return res.status(404).json({ error: 'Assigned user does not exist.' });
    }
    const assigneeMember = db.findOne('workspaceMembers', m => m.userId === assignedTo && m.companyId === req.user.companyId);
    if (!assigneeMember) {
      return res.status(400).json({ error: 'Assigned user does not belong to your company.' });
    }
    if (req.user.role === 'LEADER' && assignee.teamId !== req.user.teamId) {
      return res.status(403).json({ error: 'Forbidden. Leader can only assign tasks to employees within their own team.' });
    }
    updates.assignedTo = assignedTo;
  }

  if (req.user.role === 'LEADER' && task.approvalStatus === 'REJECTED') {
    updates.approvalStatus = 'PENDING_APPROVAL';
    updates.rejectionReason = null;
  }

  const updatedTask = db.update('tasks', task.id, updates);

  if (req.user.role === 'LEADER') {
    const managers = db.find('workspaceMembers', m => m.companyId === req.user.companyId && m.role === 'MANAGER');
    const managerUser = managers.length > 0 ? db.findById('users', managers[0].userId) : null;

    logActivity({
      companyId: req.user.companyId,
      taskId: task.id,
      userId: req.user.id,
      action: 'RESUBMITTED',
      details: `Leader ${req.user.name} revised rejected task "${updatedTask.title}" and resubmitted for Manager approval.`,
      notifyUserId: managerUser ? managerUser.id : null,
      notificationType: 'APPROVAL_REQUEST',
      notificationTitle: 'Resubmitted Task Review',
      notificationMessage: `${req.user.name} revised and resubmitted "${updatedTask.title}" for approval.`
    });
  } else {
    logActivity({
      companyId: req.user.companyId,
      taskId: task.id,
      userId: req.user.id,
      action: 'TASK_EDITED',
      details: `Manager ${req.user.name} updated task "${updatedTask.title}" properties.`
    });
  }

  res.json({
    message: updates.approvalStatus === 'PENDING_APPROVAL' 
      ? 'Task revised and resubmitted for Manager approval.' 
      : 'Task updated successfully.',
    task: updatedTask
  });
});

// Delete Task (Manager Only)
router.delete('/:id', requireWorkspace, requireRole('MANAGER'), (req, res) => {
  const taskId = req.params.id;
  const task = db.findById('tasks', taskId);

  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  db.delete('tasks', taskId);

  logActivity({
    companyId: req.user.companyId,
    taskId: null,
    userId: req.user.id,
    action: 'TASK_DELETED',
    details: `Manager ${req.user.name} deleted task "${task.title}".`
  });

  res.json({ message: 'Task deleted successfully.' });
});

module.exports = router;
