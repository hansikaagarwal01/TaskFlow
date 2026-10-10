const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireWorkspace } = require('../middleware/rbac');
const { generateAIInsights } = require('../services/aiInsightEngine');
const {
  analyzeWorkload,
  analyzeTaskRisk,
  generateTeamWorkloadSummary
} = require('../services/aiService');
const { logActivity } = require('../services/activityLogger');

const router = express.Router();

router.use(authenticate);

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many AI analysis requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(aiRateLimiter);

// GET /api/ai/workload - Workload analysis for authenticated user
router.get('/workload', async (req, res) => {
  try {
    const analysis = await analyzeWorkload(req.user.id, req.user.companyId);
    if (!analysis) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate workload analysis.' });
  }
});

// GET /api/ai/workload/:userId - Workload analysis for specified user (RBAC & Tenant Enforced)
router.get('/workload/:userId', async (req, res) => {
  const targetUserId = req.params.userId;
  const targetUser = db.findById('users', targetUserId);

  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found.' });
  }

  // Tenant Boundary Check
  const isTargetMember = db.findOne('workspaceMembers', m => m.userId === targetUserId && m.companyId === req.user.companyId);
  if (!isTargetMember) {
    return res.status(404).json({ error: 'Target user not found in your workspace.' });
  }

  // RBAC Scoping Enforcement
  if (req.user.role === 'EMPLOYEE' && targetUserId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden. Employees can only view their own workload analysis.' });
  }
  if (req.user.role === 'LEADER' && targetUser.teamId !== req.user.teamId && targetUserId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden. Leaders can only view workload analysis for members of their assigned team.' });
  }

  try {
    const analysis = await analyzeWorkload(targetUserId, req.user.companyId);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate workload analysis.' });
  }
});

// GET /api/ai/task-risk/:taskId - Risk analysis for specified task (RBAC & Tenant Enforced)
router.get('/task-risk/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  const task = db.findById('tasks', taskId);

  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  // RBAC Scoping Enforcement
  if (req.user.role === 'LEADER' && task.teamId !== req.user.teamId) {
    return res.status(403).json({ error: 'Forbidden. Access denied to task risk analysis outside your team.' });
  }
  if (req.user.role === 'EMPLOYEE' && task.assignedTo !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden. Access denied to task risk analysis for tasks not assigned to you.' });
  }

  try {
    const analysis = await analyzeTaskRisk(taskId, req.user.companyId);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate task risk analysis.' });
  }
});

// GET /api/ai/team-summary - Team Workload Summary (Manager & Leader Only)
router.get('/team-summary', requireRole('MANAGER', 'LEADER'), async (req, res) => {
  try {
    const teamScope = req.user.role === 'LEADER' ? req.user.teamId : null;
    const summary = await generateTeamWorkloadSummary(req.user.companyId, teamScope);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate team workload summary.' });
  }
});

// GET /api/ai/insights - Legacy Dashboard AI Insights
router.get('/insights', (req, res) => {
  const teamScope = req.user.role === 'LEADER' ? req.user.teamId : null;
  const insights = generateAIInsights(req.user.companyId, teamScope);
  res.json(insights);
});

// POST /api/ai/rebalance - Execute AI Workload Rebalance Recommendation (Manager/Leader)
router.post('/rebalance', requireWorkspace, requireRole('MANAGER', 'LEADER'), (req, res) => {
  const { taskId, newAssigneeId } = req.body;

  if (!taskId || !newAssigneeId) {
    return res.status(400).json({ error: 'taskId and newAssigneeId are required.' });
  }

  const task = db.findById('tasks', taskId);
  if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const newAssignee = db.findById('users', newAssigneeId);
  if (!newAssignee) {
    return res.status(404).json({ error: 'Target user does not exist.' });
  }

  const isNewAssigneeMember = db.findOne('workspaceMembers', m => m.userId === newAssigneeId && m.companyId === req.user.companyId);
  if (!isNewAssigneeMember) {
    return res.status(400).json({ error: 'Target user does not belong to your company.' });
  }

  if (req.user.role === 'LEADER') {
    if (task.teamId !== req.user.teamId) {
      return res.status(403).json({ error: 'Forbidden. Leader can only rebalance tasks within their own team.' });
    }
    if (newAssignee.teamId !== req.user.teamId) {
      return res.status(403).json({ error: 'Forbidden. Leader can only reassign tasks to employees within their own team.' });
    }
  }

  const updatedTask = db.update('tasks', taskId, {
    assignedTo: newAssigneeId,
    updatedAt: new Date().toISOString()
  });

  logActivity({
    companyId: req.user.companyId,
    taskId: task.id,
    userId: req.user.id,
    action: 'REASSIGNED_BY_AI',
    details: `${req.user.name} accepted AI workload recommendation and reassigned "${task.title}" to ${newAssignee.name}.`,
    notifyUserId: newAssignee.id,
    notificationType: 'TASK_ASSIGNED',
    notificationTitle: 'Task Reassigned to You',
    notificationMessage: `Task "${task.title}" has been reassigned to you by ${req.user.name}.`
  });

  res.json({
    message: `Task successfully reassigned to ${newAssignee.name}. Workload rebalanced!`,
    task: updatedTask
  });
});

module.exports = router;
