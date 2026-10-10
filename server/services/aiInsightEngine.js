const db = require('../db/database');

/**
 * Calculates AI-driven risk analysis and workload bottlenecks scoped by companyId & teamId
 */
function generateAIInsights(companyId = null, teamId = null) {
  let tasks = db.find('tasks', t => !companyId || t.companyId === companyId);
  let companyMembers = companyId ? db.find('workspaceMembers', m => m.companyId === companyId) : db.find('workspaceMembers');
  let companyUserIds = companyMembers.map(m => m.userId);
  let users = db.find('users', u => companyUserIds.includes(u.id));
  let teams = db.find('teams', t => !companyId || t.companyId === companyId);

  if (teamId) {
    tasks = tasks.filter(t => t.teamId === teamId);
    users = users.filter(u => u.teamId === teamId);
  }

  const today = new Date();

  const analyzedTasks = tasks.map(task => {
    let riskScore = 15;
    const reasons = [];

    const dueDate = new Date(task.dueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (task.status !== 'COMPLETED') {
      if (diffDays < 0) {
        riskScore += 50;
        reasons.push(`Overdue by ${Math.abs(diffDays)} day(s)`);
      } else if (diffDays <= 2) {
        riskScore += 30;
        reasons.push(`Due within ${diffDays} day(s)`);
      } else if (diffDays <= 5) {
        riskScore += 15;
        reasons.push(`Approaching deadline in ${diffDays} days`);
      }

      if (task.priority === 'HIGH') {
        riskScore += 25;
        reasons.push('High priority classification');
      }

      if (task.approvalStatus === 'PENDING_APPROVAL') {
        riskScore += 20;
        reasons.push('Awaiting manager approval');
      } else if (task.approvalStatus === 'REJECTED') {
        riskScore += 35;
        reasons.push('Rejected & requires leader revision');
      }
    } else {
      riskScore = 0;
    }

    const level = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

    return {
      ...task,
      riskScore: Math.min(riskScore, 100),
      riskLevel: level,
      riskReasons: reasons
    };
  });

  const employeeWorkload = users
    .filter(u => u.role === 'EMPLOYEE' || u.role === 'LEADER')
    .map(user => {
      const userTasks = tasks.filter(t => t.assignedTo === user.id);
      const activeTasks = userTasks.filter(t => t.status !== 'COMPLETED');
      const highPriorityActive = activeTasks.filter(t => t.priority === 'HIGH');
      const overdueTasks = activeTasks.filter(t => new Date(t.dueDate) < today);

      let status = 'BALANCED';
      if (activeTasks.length >= 3 || highPriorityActive.length >= 2 || overdueTasks.length >= 1) {
        status = 'OVERLOADED';
      } else if (activeTasks.length === 0) {
        status = 'UNDERUTILIZED';
      }

      return {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        teamId: user.teamId,
        totalAssigned: userTasks.length,
        activeTasksCount: activeTasks.length,
        completedTasksCount: userTasks.length - activeTasks.length,
        highPriorityCount: highPriorityActive.length,
        overdueCount: overdueTasks.length,
        status
      };
    });

  const recommendations = [];
  const overloadedUsers = employeeWorkload.filter(w => w.status === 'OVERLOADED');
  const underutilizedUsers = employeeWorkload.filter(w => w.status === 'UNDERUTILIZED' || w.activeTasksCount <= 1);

  if (overloadedUsers.length > 0 && underutilizedUsers.length > 0) {
    const srcUser = overloadedUsers[0];
    const dstUser = underutilizedUsers[0];
    const srcTasks = tasks.filter(t => t.assignedTo === srcUser.userId && t.status === 'PENDING');

    if (srcTasks.length > 0) {
      recommendations.push({
        type: 'WORKLOAD_REBALANCE',
        title: 'Rebalance Team Workload',
        message: `${srcUser.userName} has ${srcUser.activeTasksCount} active tasks (${srcUser.highPriorityCount} high priority). Consider reassigning task "${srcTasks[0].title}" to ${dstUser.userName}.`,
        taskId: srcTasks[0].id,
        suggestedUser: dstUser.userId
      });
    }
  }

  const pendingApprovalsCount = tasks.filter(t => t.approvalStatus === 'PENDING_APPROVAL').length;
  if (pendingApprovalsCount > 0) {
    recommendations.push({
      type: 'APPROVAL_BOTTLENECK',
      title: 'Approval Queue Action Required',
      message: `There are currently ${pendingApprovalsCount} task(s) awaiting manager review. Approving these will unblock execution for assigned engineers.`,
      actionUrl: '/approvals'
    });
  }

  const highRiskTasks = analyzedTasks.filter(t => t.riskLevel === 'HIGH' && t.status !== 'COMPLETED');
  if (highRiskTasks.length > 0) {
    recommendations.push({
      type: 'DEADLINE_RISK',
      title: 'High Risk Task Deadline Warning',
      message: `Task "${highRiskTasks[0].title}" has a high risk score (${highRiskTasks[0].riskScore}/100) due to: ${highRiskTasks[0].riskReasons.join(', ')}.`,
      taskId: highRiskTasks[0].id
    });
  }

  const executiveSummary = {
    totalTasks: tasks.length,
    activeTasks: tasks.filter(t => t.status !== 'COMPLETED').length,
    completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
    pendingApprovals: pendingApprovalsCount,
    overdueTasks: tasks.filter(t => t.status !== 'COMPLETED' && new Date(t.dueDate) < today).length,
    highRiskTasksCount: highRiskTasks.length,
    healthScore: Math.max(10, 100 - (highRiskTasks.length * 15) - (pendingApprovalsCount * 10))
  };

  return {
    executiveSummary,
    analyzedTasks,
    employeeWorkload,
    recommendations
  };
}

module.exports = { generateAIInsights };
