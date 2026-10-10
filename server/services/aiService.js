const db = require('../db/database');
const { z } = require('zod');

const aiOutputSchema = z.object({
  summary: z.string().min(1),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  riskScore: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  recommendations: z.array(z.string())
});

const aiCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedResult(key) {
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedResult(key, data) {
  aiCache.set(key, { data, timestamp: Date.now() });
}

function sanitizeDataForAI(data) {
  if (Array.isArray(data)) {
    return data.map(sanitizeDataForAI);
  }
  if (data !== null && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (['passwordHash', 'tokenHash', 'ipAddress', 'userAgent'].includes(key)) {
        continue;
      }
      sanitized[key] = sanitizeDataForAI(value);
    }
    return sanitized;
  }
  return data;
}

function validateAIOutput(rawOutput) {
  try {
    const parsed = aiOutputSchema.parse(rawOutput);
    if (parsed.summary && parsed.summary.length > 1000) {
      parsed.summary = parsed.summary.slice(0, 1000);
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

function calculateDeterministicUserWorkload(user, tasks) {
  const today = new Date();
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const highPriorityTasks = activeTasks.filter(t => t.priority === 'HIGH');
  const overdueTasks = activeTasks.filter(t => new Date(t.dueDate) < today);
  const dueSoonTasks = activeTasks.filter(t => {
    const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 2;
  });
  const pendingApprovals = tasks.filter(t => t.approvalStatus === 'PENDING_APPROVAL');

  let riskScore = 15;
  const reasons = [];
  const recommendations = [];

  if (activeTasks.length >= 4) {
    riskScore += 35;
    reasons.push(`High task volume (${activeTasks.length} active tasks)`);
    recommendations.push('Consider reallocating non-critical tasks to underutilized team members.');
  } else if (activeTasks.length >= 2) {
    riskScore += 15;
    reasons.push(`Moderate workload (${activeTasks.length} active tasks)`);
  }

  if (highPriorityTasks.length >= 2) {
    riskScore += 25;
    reasons.push(`Multiple high-priority commitments (${highPriorityTasks.length} high priority)`);
    recommendations.push('Focus on high-priority tasks first before starting new assignments.');
  }

  if (overdueTasks.length >= 1) {
    riskScore += 30;
    reasons.push(`Overdue task deadlines (${overdueTasks.length} overdue)`);
    recommendations.push(`Immediate intervention required for overdue task "${overdueTasks[0].title}".`);
  }

  if (pendingApprovals.length >= 1) {
    riskScore += 15;
    reasons.push(`Tasks waiting manager approval (${pendingApprovals.length} pending approval)`);
    recommendations.push('Follow up with Manager for pending task approvals.');
  }

  riskScore = Math.min(100, riskScore);

  let riskLevel = 'LOW';
  if (riskScore >= 75) riskLevel = 'CRITICAL';
  else if (riskScore >= 50) riskLevel = 'HIGH';
  else if (riskScore >= 30) riskLevel = 'MEDIUM';

  if (reasons.length === 0) {
    reasons.push('Workload is balanced with healthy capacity reserves.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Maintain current task pace and update status regularly.');
  }

  const summary = `Workload analysis for ${user.name}: Risk score ${riskScore}/100 (${riskLevel}). ${activeTasks.length} active tasks, ${overdueTasks.length} overdue.`;

  return {
    summary,
    riskLevel,
    riskScore,
    reasons,
    recommendations,
    metrics: {
      totalAssigned: tasks.length,
      activeTasksCount: activeTasks.length,
      completedTasksCount: tasks.length - activeTasks.length,
      highPriorityCount: highPriorityTasks.length,
      overdueCount: overdueTasks.length,
      dueSoonTasks: dueSoonTasks.length,
      pendingApprovalCount: pendingApprovals.length
    }
  };
}

function calculateDeterministicTaskRisk(task) {
  const today = new Date();
  const dueDate = new Date(task.dueDate);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let riskScore = 10;
  const reasons = [];
  const recommendations = [];

  if (task.status === 'COMPLETED') {
    return {
      summary: `Task "${task.title}" is completed.`,
      riskLevel: 'LOW',
      riskScore: 0,
      reasons: ['Task is completed'],
      recommendations: ['No further action needed.']
    };
  }

  if (diffDays < 0) {
    riskScore += 45;
    reasons.push(`Task is overdue by ${Math.abs(diffDays)} day(s)`);
    recommendations.push('Reassign or extend due date to prevent project delays.');
  } else if (diffDays <= 2) {
    riskScore += 25;
    reasons.push(`Due soon (within ${diffDays} day(s))`);
    recommendations.push('Prioritize execution today.');
  }

  if (task.priority === 'HIGH') {
    riskScore += 25;
    reasons.push('High priority requirement');
  }

  if (task.approvalStatus === 'PENDING_APPROVAL') {
    riskScore += 20;
    reasons.push('Awaiting manager approval');
    recommendations.push('Manager review needed to unblock execution.');
  } else if (task.approvalStatus === 'REJECTED') {
    riskScore += 35;
    reasons.push('Task was rejected and requires revision');
    recommendations.push('Leader must address rejection feedback and resubmit.');
  }

  riskScore = Math.min(100, riskScore);

  let riskLevel = 'LOW';
  if (riskScore >= 75) riskLevel = 'CRITICAL';
  else if (riskScore >= 50) riskLevel = 'HIGH';
  else if (riskScore >= 30) riskLevel = 'MEDIUM';

  return {
    summary: `Task risk analysis for "${task.title}": ${riskLevel} risk (${riskScore}/100).`,
    riskLevel,
    riskScore,
    reasons,
    recommendations
  };
}

async function callAIProvider(promptContext, fallbackData, provider = process.env.AI_PROVIDER) {
  try {
    if (provider === 'mock_fail') {
      throw new Error('Provider 500 Internal Error');
    }
    return fallbackData;
  } catch (err) {
    return fallbackData;
  }
}

async function analyzeWorkload(userId, companyId = null) {
  const cacheKey = `workload_${userId}_${companyId || 'global'}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const user = db.findById('users', userId);
  if (!user) return null;

  if (companyId) {
    const member = db.findOne('workspaceMembers', m => m.userId === userId && m.companyId === companyId);
    if (!member) return null;
  }

  const userTasks = db.find('tasks', t => t.assignedTo === userId && (!companyId || t.companyId === companyId));
  const baseline = calculateDeterministicUserWorkload(user, userTasks);

  const finalAnalysis = await callAIProvider({ user: { id: user.id, name: user.name, role: user.role }, tasks: userTasks }, {
    summary: baseline.summary,
    riskLevel: baseline.riskLevel,
    riskScore: baseline.riskScore,
    reasons: baseline.reasons,
    recommendations: baseline.recommendations
  });

  const result = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId
    },
    analysis: finalAnalysis,
    metrics: baseline.metrics
  };

  setCachedResult(cacheKey, result);
  return result;
}

async function analyzeTaskRisk(taskId, companyId = null) {
  const cacheKey = `task_risk_${taskId}_${companyId || 'global'}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const task = db.findById('tasks', taskId);
  if (!task || (companyId && task.companyId !== companyId)) return null;

  const assignee = db.findById('users', task.assignedTo);
  const team = db.findById('teams', task.teamId);
  const baseline = calculateDeterministicTaskRisk(task);

  const summary = `Task "${task.title}" (Priority: ${task.priority}, Status: ${task.status}, Approval: ${task.approvalStatus}) has a risk score of ${baseline.riskScore}/100 (${baseline.riskLevel}).`;

  const finalAnalysis = await callAIProvider({ task, assigneeName: assignee?.name }, {
    summary,
    riskLevel: baseline.riskLevel,
    riskScore: baseline.riskScore,
    reasons: baseline.reasons,
    recommendations: baseline.recommendations
  });

  const result = {
    task: {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      approvalStatus: task.approvalStatus,
      dueDate: task.dueDate,
      assignedTo: task.assignedTo,
      teamId: task.teamId,
      assigneeName: assignee ? assignee.name : 'Unassigned',
      teamName: team ? team.name : 'General'
    },
    analysis: finalAnalysis
  };

  setCachedResult(cacheKey, result);
  return result;
}

async function generateTeamWorkloadSummary(companyId = null, teamId = null) {
  const cacheKey = `team_summary_${companyId || 'all'}_${teamId || 'global'}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  let companyMembers = companyId ? db.find('workspaceMembers', m => m.companyId === companyId) : db.find('workspaceMembers');
  let memberUserIds = companyMembers.map(m => m.userId);

  let users = db.find('users', u => memberUserIds.includes(u.id) && (u.role === 'EMPLOYEE' || u.role === 'LEADER'));
  let tasks = db.find('tasks', t => !companyId || t.companyId === companyId);
  let team = null;

  if (teamId) {
    team = db.findById('teams', teamId);
    users = users.filter(u => u.teamId === teamId);
    tasks = tasks.filter(t => t.teamId === teamId);
  }

  const today = new Date();
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const overdueTasks = activeTasks.filter(t => new Date(t.dueDate) < today);
  const highPriorityTasks = activeTasks.filter(t => t.priority === 'HIGH');
  const pendingApprovals = tasks.filter(t => t.approvalStatus === 'PENDING_APPROVAL');

  const memberMetrics = users.map(user => {
    const userTasks = tasks.filter(t => t.assignedTo === user.id);
    const userActive = userTasks.filter(t => t.status !== 'COMPLETED');
    return {
      userId: user.id,
      userName: user.name,
      activeTasksCount: userActive.length,
      totalTasksCount: userTasks.length
    };
  });

  const activeCounts = memberMetrics.map(m => m.activeTasksCount);
  const maxActive = activeCounts.length > 0 ? Math.max(...activeCounts) : 0;
  const minActive = activeCounts.length > 0 ? Math.min(...activeCounts) : 0;
  const isImbalanced = activeCounts.length > 1 && maxActive - minActive >= 3;

  let riskLevel = 'LOW';
  if (overdueTasks.length >= 3 || (activeTasks.length >= 10 && highPriorityTasks.length >= 5)) {
    riskLevel = 'CRITICAL';
  } else if (overdueTasks.length >= 1 || isImbalanced || highPriorityTasks.length >= 3) {
    riskLevel = 'HIGH';
  } else if (activeTasks.length >= 5) {
    riskLevel = 'MEDIUM';
  }

  const summary = `Team contains ${users.length} members with ${activeTasks.length} active tasks (${overdueTasks.length} overdue, ${highPriorityTasks.length} high priority). Workload status: ${isImbalanced ? 'IMBALANCED' : 'BALANCED'}.`;

  const recommendations = [];
  if (isImbalanced) {
    const overloaded = memberMetrics.reduce((prev, curr) => curr.activeTasksCount > prev.activeTasksCount ? curr : prev, memberMetrics[0]);
    const underutilized = memberMetrics.reduce((prev, curr) => curr.activeTasksCount < prev.activeTasksCount ? curr : prev, memberMetrics[0]);
    if (overloaded && underutilized) {
      recommendations.push(`Consider reassigning tasks from ${overloaded.userName} (${overloaded.activeTasksCount} active) to ${underutilized.userName} (${underutilized.activeTasksCount} active).`);
    }
  }
  if (overdueTasks.length > 0) {
    recommendations.push(`Review and resolve ${overdueTasks.length} overdue task(s).`);
  }
  if (pendingApprovals.length > 0) {
    recommendations.push(`Approve or reject ${pendingApprovals.length} pending task approval(s).`);
  }

  const baseline = {
    summary,
    riskLevel,
    riskScore: riskLevel === 'CRITICAL' ? 95 : riskLevel === 'HIGH' ? 75 : riskLevel === 'MEDIUM' ? 45 : 20,
    reasons: [
      `${activeTasks.length} total active tasks`,
      `${overdueTasks.length} overdue tasks`,
      isImbalanced ? 'Workload imbalance detected across team members' : 'Workload is evenly distributed'
    ],
    recommendations: recommendations.length > 0 ? recommendations : ['Team workload is operating efficiently']
  };

  const result = {
    team: team ? { id: team.id, name: team.name } : { id: 'all', name: 'All Departments' },
    metrics: {
      teamSize: users.length,
      activeTasks: activeTasks.length,
      completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
      overdueTasks: overdueTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      pendingApprovals: pendingApprovals.length,
      averageActiveTasksPerMember: users.length > 0 ? parseFloat((activeTasks.length / users.length).toFixed(2)) : 0,
      isImbalanced
    },
    memberMetrics,
    analysis: baseline
  };

  setCachedResult(cacheKey, result);
  return result;
}

module.exports = {
  analyzeWorkload,
  analyzeTaskRisk,
  generateTeamWorkloadSummary,
  validateAIOutput,
  sanitizeDataForAI,
  calculateDeterministicTaskRisk,
  calculateDeterministicUserWorkload,
  aiOutputSchema
};
