const db = require('../db/database');

function requireWorkspace(req, res, next) {
  if (!req.user || !req.user.companyId) {
    return res.status(403).json({
      error: 'Forbidden. Active workspace membership required to access this resource.'
    });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ error: 'Forbidden. Active workspace membership required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation.`
      });
    }

    next();
  };
}

const requireManager = requireRole('MANAGER');
const requireLeader = requireRole('LEADER');
const requireEmployee = requireRole('EMPLOYEE');

function requireTeamAccess(req, res, next) {
  const targetTeamId = req.params.teamId || req.params.id || req.query.teamId || req.body.teamId;

  if (req.user.role === 'MANAGER') {
    return next();
  }

  if (!req.user.teamId || req.user.teamId !== targetTeamId) {
    return res.status(403).json({
      error: 'Access denied. You can only access your own assigned team.'
    });
  }

  next();
}

function validateTaskAccess(action) {
  return (req, res, next) => {
    const taskId = req.params.id;
    const task = db.findById('tasks', taskId);

    if (!task || (req.user.companyId && task.companyId !== req.user.companyId)) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    req.targetTask = task;

    if (req.user.role === 'MANAGER') {
      return next();
    }

    if (req.user.role === 'LEADER') {
      if (task.teamId !== req.user.teamId) {
        return res.status(403).json({ error: 'Access denied. Leader can only access tasks within their assigned team.' });
      }

      if (action === 'edit' || action === 'resubmit') {
        if (task.approvalStatus !== 'REJECTED') {
          console.log('DEBUG 400 REASON: task.approvalStatus is', task.approvalStatus);
          return res.status(400).json({ error: 'Only rejected tasks can be edited and resubmitted by leaders.' });
        }
      }

      if (action === 'approve' || action === 'reject') {
        return res.status(403).json({ error: 'Forbidden. Leaders cannot approve or reject tasks.' });
      }

      return next();
    }

    if (req.user.role === 'EMPLOYEE') {
      if (action === 'update_status') {
        if (task.assignedTo !== req.user.id) {
          return res.status(403).json({ error: 'Access denied. You can only update status for tasks assigned to you.' });
        }
        return next();
      }

      return res.status(403).json({ error: 'Access denied. Employees cannot modify task properties or approve tasks.' });
    }

    return res.status(403).json({ error: 'Access denied. Action not allowed.' });
  };
}

module.exports = {
  requireWorkspace,
  requireRole,
  requireManager,
  requireLeader,
  requireEmployee,
  requireTeamAccess,
  validateTaskAccess
};
