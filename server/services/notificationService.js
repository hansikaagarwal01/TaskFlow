const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const VALID_NOTIFICATION_TYPES = [
  'APPROVAL_REQUEST',
  'TASK_APPROVED',
  'TASK_REJECTED',
  'TASK_ASSIGNED',
  'TASK_COMPLETED',
  'SYSTEM'
];

function createNotification({ companyId = null, userId, title, message, type = 'SYSTEM', taskId = null }) {
  if (!userId) {
    throw new Error('userId is required for creating a notification');
  }

  const user = db.findById('users', userId);
  if (!user) {
    return null;
  }

  if (!companyId) {
    companyId = user.activeCompanyId;
  }

  const normalizedType = VALID_NOTIFICATION_TYPES.includes(type) ? type : 'SYSTEM';

  const recentCutoff = new Date(Date.now() - 5000).toISOString();
  const duplicate = db.findOne('notifications', n =>
    n.userId === userId &&
    n.type === normalizedType &&
    n.taskId === (taskId || null) &&
    n.title === title &&
    n.createdAt >= recentCutoff
  );

  if (duplicate) {
    return duplicate;
  }

  const notification = {
    id: `notif-${uuidv4().slice(0, 8)}`,
    companyId,
    userId,
    title: title || 'TaskFlow Notification',
    message: message || '',
    type: normalizedType,
    taskId: taskId || null,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  return db.insert('notifications', notification);
}

function createNotifications(notifications = []) {
  return notifications.map(n => createNotification(n)).filter(Boolean);
}

function getUserNotifications(userId, options = {}) {
  let { page = 1, limit = 20, pageSize = 20, isRead, companyId } = options;

  page = parseInt(page, 10);
  limit = parseInt(limit || pageSize, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  let notifications = db.find('notifications', n => n.userId === userId && (!companyId || n.companyId === companyId));

  if (isRead !== undefined && isRead !== null && isRead !== '') {
    const isReadBool = isRead === true || isRead === 'true';
    notifications = notifications.filter(n => n.isRead === isReadBool);
  }

  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = notifications.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = notifications.slice((page - 1) * limit, page * limit);

  return {
    notifications: paginated,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages
    }
  };
}

function markAsRead(notificationId, userId) {
  const notification = db.findById('notifications', notificationId);
  if (!notification) {
    return { status: 404, error: 'Notification not found.' };
  }

  if (notification.userId !== userId) {
    return { status: 403, error: 'Forbidden. Access denied to notification belonging to another user.' };
  }

  const updated = db.update('notifications', notificationId, { isRead: true });
  return { status: 200, notification: updated };
}

function markAllAsRead(userId) {
  const userNotifs = db.find('notifications', n => n.userId === userId && !n.isRead);
  userNotifs.forEach(n => {
    db.update('notifications', n.id, { isRead: true });
  });

  return { count: userNotifs.length };
}

module.exports = {
  createNotification,
  createNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  VALID_NOTIFICATION_TYPES
};
