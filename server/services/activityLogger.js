const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { createNotification } = require('./notificationService');

const VALID_AUDIT_ACTIONS = [
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'STATUS_CHANGED',
  'TASK_APPROVED',
  'TASK_REJECTED',
  'TASK_RESUBMITTED',
  'TASK_COMPLETED',
  'IMPORTANT_TASK_UPDATED',
  'TASK_EDITED',
  'TASK_DELETED',
  'SUBMITTED_FOR_APPROVAL',
  'USER_LOGIN',
  'DEMO_LOGIN',
  'SECURITY_ALERT',
  'USER_LOGOUT',
  'USER_LOGOUT_ALL',
  'APPROVED',
  'REJECTED',
  'RESUBMITTED',
  'USER_REGISTER',
  'WORKSPACE_CREATED',
  'WORKSPACE_JOINED',
  'INVITATION_CREATED',
  'REASSIGNED_BY_AI'
];

function logActivity(arg1, arg2, arg3, arg4, arg5) {
  let companyId = null;
  let taskId = null;
  let userId = null;
  let action = 'ACTION_PERFORMED';
  let details = '';
  let notifyUserId = null;
  let notificationType = null;
  let notificationTitle = '';
  let notificationMessage = '';

  if (arg1 && typeof arg1 === 'object') {
    ({
      companyId = null,
      taskId = null,
      userId,
      action,
      details = '',
      notifyUserId = null,
      notificationType = null,
      notificationTitle = '',
      notificationMessage = ''
    } = arg1);
  } else {
    userId = arg1;
    action = arg2 || 'ACTION_PERFORMED';
    details = arg3 || '';
    companyId = arg5 || null;
  }

  if (!userId) {
    throw new Error('userId (actor identity) is required for audit logging');
  }

  // Fallback to user's active company if not specified
  if (!companyId) {
    const actor = db.findById('users', userId);
    if (actor) companyId = actor.activeCompanyId;
  }

  const timestamp = new Date().toISOString();

  const activityLog = db.insert('activityLogs', {
    id: `act-${uuidv4().slice(0, 8)}`,
    companyId,
    taskId: taskId || null,
    userId,
    action: action || 'ACTION_PERFORMED',
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    timestamp,
    createdAt: timestamp
  });

  if (notifyUserId) {
    createNotification({
      companyId,
      userId: notifyUserId,
      title: notificationTitle || 'TaskFlow Notification',
      message: notificationMessage || details,
      type: notificationType || 'SYSTEM',
      taskId
    });
  }

  return activityLog;
}

function getTaskActivityLogs(taskId, user, options = {}) {
  let { page = 1, limit = 20, pageSize = 20 } = options;

  page = parseInt(page, 10);
  limit = parseInt(limit || pageSize, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  const task = db.findById('tasks', taskId);
  if (!task || (user.companyId && task.companyId !== user.companyId)) {
    return { status: 404, error: 'Task not found.' };
  }

  if (user.role === 'LEADER' && task.teamId !== user.teamId) {
    return { status: 403, error: 'Forbidden. Access denied to task activity outside your team.' };
  }
  if (user.role === 'EMPLOYEE' && task.assignedTo !== user.id) {
    return { status: 403, error: 'Forbidden. Access denied to task activity not assigned to you.' };
  }

  let logs = db.find('activityLogs', l => l.taskId === taskId && (!user.companyId || l.companyId === user.companyId));

  const users = db.find('users');
  const enriched = logs.map(log => {
    const actor = users.find(u => u.id === log.userId);
    return {
      ...log,
      userName: actor ? actor.name : 'System User',
      userAvatar: actor ? actor.avatar : null,
      userRole: actor ? actor.role : 'SYSTEM',
      taskTitle: task.title
    };
  });

  enriched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = enriched.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = enriched.slice((page - 1) * limit, page * limit);

  return {
    status: 200,
    activities: paginated,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages
    }
  };
}

module.exports = {
  logActivity,
  getTaskActivityLogs,
  VALID_AUDIT_ACTIONS
};
