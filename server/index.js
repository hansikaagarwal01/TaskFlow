const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config');
const { authRateLimiter } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const workspacesRoutes = require('./routes/workspaces');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');
const tasksRoutes = require('./routes/tasks');
const approvalsRoutes = require('./routes/approvals');
const analyticsRoutes = require('./routes/analytics');
const activityRoutes = require('./routes/activity');
const notificationsRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration (Must allow credentials for HttpOnly cookies)
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Rate limiting on sensitive auth endpoints
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/demo-login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ai', aiRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'TaskFlow Backend API',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    console.log(`TaskFlow Server running at http://localhost:${config.PORT}`);
  });
}

module.exports = app;
