const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead
} = require('../services/notificationService');

const router = express.Router();

router.use(authenticate);

// Get Authenticated User Notifications with Pagination & Filtering
router.get('/', (req, res) => {
  const { page, limit, pageSize, isRead } = req.query;

  if (page !== undefined) {
    const parsedPage = parseInt(page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ error: 'Invalid page number. Page must be an integer >= 1.' });
    }
  }

  const rawLimit = limit || pageSize;
  if (rawLimit !== undefined) {
    const parsedLimit = parseInt(rawLimit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ error: 'Invalid pageSize or limit parameter. Must be an integer >= 1.' });
    }
  }

  if (isRead !== undefined && isRead !== '' && isRead !== 'true' && isRead !== 'false' && typeof isRead !== 'boolean') {
    return res.status(400).json({ error: 'Invalid isRead filter parameter. Must be true or false.' });
  }

  const result = getUserNotifications(req.user.id, { page, limit: rawLimit, isRead, companyId: req.user.companyId });
  res.json(result);
});

// Mark Single Notification as Read
const handleMarkRead = (req, res) => {
  const notifId = req.params.id;
  if (!notifId || typeof notifId !== 'string') {
    return res.status(400).json({ error: 'Invalid notification ID.' });
  }

  const result = markAsRead(notifId, req.user.id);
  if (result.status !== 200) {
    return res.status(result.status).json({ error: result.error });
  }

  res.json(result.notification);
};

router.patch('/:id/read', handleMarkRead);
router.put('/:id/read', handleMarkRead);

// Mark All User Notifications as Read
const handleMarkAllRead = (req, res) => {
  const result = markAllAsRead(req.user.id);
  res.json({ message: 'All notifications marked as read.', count: result.count });
};

router.post('/read-all', handleMarkAllRead);
router.put('/read-all', handleMarkAllRead);

module.exports = router;
