import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { TaskCard } from '../components/TaskCard';
import { 
  CheckSquare, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight,
  Sparkles,
  Activity,
  User,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  Users
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export const DashboardPage = ({ onNavigateTab, onSelectTask, onOpenRejectModal, onOpenResubmitModal }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsData, tasksData, approvalsData, activityData, aiData] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/tasks'),
        (user?.role === 'MANAGER' || user?.role === 'LEADER') ? api.get('/approvals') : Promise.resolve([]),
        api.get('/activity'),
        api.get('/ai/insights')
      ]);

      setMetrics(analyticsData.metrics);
      setTeamPerformance(analyticsData.teamPerformance || []);
      setActiveTasks(tasksData.filter(t => t.status !== 'COMPLETED').slice(0, 4));
      setPendingApprovals(approvalsData);
      setRecentActivity(activityData.slice(0, 5));
      setAiInsights(aiData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleApprove = async (taskId) => {
    try {
      await api.post(`/approvals/${taskId}/approve`);
      loadDashboardData();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      loadDashboardData();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleApplyRebalance = async (rec) => {
    if (!rec?.taskId || !rec?.suggestedUser) return;
    setRebalancing(true);
    try {
      await api.post('/ai/rebalance', {
        taskId: rec.taskId,
        newAssigneeId: rec.suggestedUser
      });
      loadDashboardData();
    } catch (err) {
      console.error('Rebalance error:', err);
    } finally {
      setRebalancing(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="page-container py-20 text-center text-xs text-[#6B5B52]">
        <div className="w-10 h-10 border-3 border-[#561C24] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Synthesizing enterprise dashboard analytics...
      </div>
    );
  }

  const getGreeting = () => {
    const firstName = user?.name ? user.name.split(' ')[0] : 'User';
    if (user?.role === 'MANAGER') {
      return {
        title: `Good day, ${firstName} 👋`,
        subtitle: 'Organization Management Overview — Active workload monitoring, approval reviews, and performance intelligence.'
      };
    } else if (user?.role === 'LEADER') {
      return {
        title: `Welcome back, ${firstName} 👋`,
        subtitle: `Team Leadership Workspace — Department velocity for ${user?.team?.name || 'assigned team'}. Tasks created require Manager approval.`
      };
    }
    return {
      title: `Welcome back, ${firstName} 👋`,
      subtitle: `Personal Work Overview — Active task assignments and progress tracking for ${user?.team?.name || 'your team'}.`
    };
  };

  const greeting = getGreeting();

  // Pie Chart Data for Project Completion
  const pieData = teamPerformance.map((tp, idx) => ({
    name: tp.teamName,
    value: tp.completedTasks || 1,
    color: idx % 2 === 0 ? '#561C24' : '#C7B7A3'
  }));

  if (pieData.length === 0) {
    pieData.push({ name: 'Completed', value: metrics.completedTasks || 1, color: '#561C24' });
    pieData.push({ name: 'In Progress', value: metrics.inProgressTasks || 1, color: '#C7B7A3' });
  }

  return (
    <div className="page-container space-y-8">
      {/* 1. Large Editorial Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-[#E8D8C4]">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#561C24] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#561C24]" />
            <span>TaskFlow Executive Workspace</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#2C1819] tracking-tight">
            {greeting.title}
          </h1>
          <p className="text-xs md:text-sm text-[#6B5B52] leading-relaxed">
            {greeting.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user?.role === 'MANAGER' && (
            <button
              onClick={() => onNavigateTab('teams')}
              className="btn-secondary text-xs rounded-xl"
            >
              <Users className="w-4 h-4 text-[#561C24]" />
              <span>Manage Teams</span>
            </button>
          )}

          <div className="px-3.5 py-2 rounded-xl bg-white border border-[#E8D8C4] shadow-sm flex items-center gap-2 text-xs font-semibold text-[#2C1819]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F]"></span>
            <span>{user?.role}</span>
          </div>
        </div>
      </div>

      {/* 2. KPI Row: First Card Distinctive Burgundy Treatment, Remaining Cards Light */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI CARD 1: DISTINCTIVE BURGUNDY TREATMENT */}
        <div className="card-burgundy-primary p-6 flex flex-col justify-between space-y-3 relative overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between text-[#FAF6F0]/80">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#FAF6F0]">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-4xl font-serif font-bold text-white tracking-tight">{metrics.totalTasks}</p>
            <span className="text-xs text-[#FAF6F0] font-semibold bg-white/15 px-2.5 py-0.5 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[#E8D8C4]" />
              {metrics.completionRate}% Done
            </span>
          </div>
        </div>

        {/* KPI CARD 2: LIGHT IN PROGRESS */}
        <div className="card-beige p-6 flex flex-col justify-between space-y-3 rounded-2xl">
          <div className="flex items-center justify-between text-[#6B5B52]">
            <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
            <div className="w-8 h-8 rounded-xl bg-[#F6F0E8] border border-[#E8D8C4] flex items-center justify-center text-[#561C24]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif font-bold text-[#2C1819] tracking-tight pt-1">{metrics.inProgressTasks}</p>
        </div>

        {/* KPI CARD 3: LIGHT PENDING REVIEW */}
        <div className="card-beige p-6 flex flex-col justify-between space-y-3 rounded-2xl">
          <div className="flex items-center justify-between text-[#6B5B52]">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Review</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF8EB] border border-[#F7E3BD] flex items-center justify-center text-[#A36A00]">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif font-bold text-[#A36A00] tracking-tight pt-1">{metrics.pendingApprovals}</p>
        </div>

        {/* KPI CARD 4: LIGHT OVERDUE */}
        <div className="card-beige p-6 flex flex-col justify-between space-y-3 rounded-2xl">
          <div className="flex items-center justify-between text-[#6B5B52]">
            <span className="text-xs font-bold uppercase tracking-wider">Overdue Tasks</span>
            <div className="w-8 h-8 rounded-xl bg-[#FDF2F2] border border-[#F8C8C8] flex items-center justify-center text-[#9B2C2C]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif font-bold text-[#9B2C2C] tracking-tight pt-1">{metrics.overdueTasks}</p>
        </div>
      </div>

      {/* 3. Main Dashboard Row: Team Progress Chart, Up Next / Pending Actions, and Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Progress Chart (Col Span 5) */}
        <div className="lg:col-span-5 card-beige p-6 space-y-4 flex flex-col justify-between rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2C1819]">Team Progress Velocity</h3>
              <p className="text-xs text-[#6B5B52]">Completion rate & active task load across departments</p>
            </div>
            <button onClick={() => onNavigateTab('analytics')} className="text-xs text-[#561C24] hover:underline font-bold flex items-center gap-1 cursor-pointer">
              <span>View Report</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamPerformance.length > 0 ? teamPerformance : [{ teamName: 'Engineering', totalTasks: 5, completedTasks: 3 }, { teamName: 'Product', totalTasks: 2, completedTasks: 1 }]}>
                <XAxis dataKey="teamName" stroke="#6B5B52" fontSize={11} />
                <YAxis stroke="#6B5B52" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8D8C4', borderRadius: '12px', fontSize: '12px', color: '#2C1819' }}
                />
                <Bar dataKey="totalTasks" name="Total Tasks" fill="#C7B7A3" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completedTasks" name="Completed" fill="#561C24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-[#F0E6D8] flex items-center justify-between text-xs text-[#6B5B52]">
            <span>Completion Index: <strong className="text-[#2D6A4F] font-bold font-mono">{metrics.completionRate}%</strong></span>
            <span>Active Capacity: <strong className="text-[#561C24] font-bold font-mono">{metrics.inProgressTasks} tasks</strong></span>
          </div>
        </div>

        {/* Up Next / Pending Actions (Col Span 7) */}
        <div className="lg:col-span-7 card-beige p-6 space-y-4 flex flex-col justify-between rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFF8EB] border border-[#F7E3BD] flex items-center justify-center text-[#A36A00]">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2C1819]">Up Next & Pending Actions</h3>
                <p className="text-xs text-[#6B5B52]">Tasks requiring immediate manager review or workflow updates</p>
              </div>
            </div>

            {(user?.role === 'MANAGER' || user?.role === 'LEADER') && (
              <button onClick={() => onNavigateTab('approvals')} className="text-xs text-[#561C24] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                <span>View All ({pendingApprovals.length})</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B5B52] bg-[#FAF6F0] rounded-xl border border-[#E8D8C4]">
              No tasks currently awaiting review. All queue items are processed.
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {pendingApprovals.slice(0, 3).map(task => (
                <div key={task.id} className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <span className="font-bold text-[#2C1819] text-sm block truncate">{task.title}</span>
                    <p className="text-[#6B5B52] text-xs">
                      Submitted by <strong className="text-[#2C1819]">{task.creatorName}</strong> for <strong className="text-[#561C24]">{task.assigneeName}</strong>
                    </p>
                  </div>

                  {user?.role === 'MANAGER' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(task.id)}
                        className="btn-success text-xs py-1.5 px-3 rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onOpenRejectModal(task)}
                        className="btn-danger text-xs py-1.5 px-3 rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Tasks Feed Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#2C1819]">
              {user?.role === 'EMPLOYEE' ? 'My Active Work Items' : 'Active Organization Tasks'}
            </h2>
            <p className="text-xs text-[#6B5B52]">Current in-flight tasks and status triggers</p>
          </div>
          <button
            onClick={() => onNavigateTab('tasks')}
            className="text-xs text-[#561C24] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Open Tasks Workspace</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {activeTasks.length === 0 ? (
          <div className="card-beige p-8 text-center text-xs text-[#6B5B52]">
            No active tasks found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {activeTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                userRole={user?.role}
                currentUserId={user?.id}
                onSelectTask={onSelectTask}
                onUpdateStatus={handleUpdateStatus}
                onApprove={handleApprove}
                onReject={onOpenRejectModal}
                onResubmit={onOpenResubmitModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Row: Team Collaboration / Recent Activity, Project Completion Chart, and Dark Burgundy Workload Insight Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Collaboration / Recent Activity (Col Span 4) */}
        <div className="lg:col-span-4 card-beige p-6 space-y-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0E6D8]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#561C24]" />
              <h3 className="font-serif text-base font-bold text-[#2C1819]">Recent Activity Stream</h3>
            </div>
            <button onClick={() => onNavigateTab('activity')} className="text-xs text-[#561C24] hover:underline font-bold flex items-center gap-1 cursor-pointer">
              <span>Audit Trail</span>
            </button>
          </div>

          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {recentActivity.map(act => (
              <div key={act.id} className="flex items-start gap-2.5 text-xs pb-2.5 border-b border-[#F0E6D8] last:border-0">
                <div className="w-6 h-6 rounded-full bg-[#F6F0E8] border border-[#E8D8C4] flex items-center justify-center text-[10px] text-[#561C24] shrink-0 font-bold">
                  <User className="w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2C1819] truncate">{act.userName}</span>
                    <span className="text-[10px] text-[#8F7E75] font-mono">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[#6B5B52] text-[11px] line-clamp-2 mt-0.5">{act.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project / Department Completion Chart (Col Span 4) */}
        <div className="lg:col-span-4 card-beige p-6 space-y-4 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-base font-bold text-[#2C1819]">Department Completion Ratio</h3>
            <p className="text-xs text-[#6B5B52]">Distribution of completed work per team</p>
          </div>

          <div className="h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8D8C4', borderRadius: '10px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-[#F0E6D8] flex items-center justify-around text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#561C24]"></span> Completed Tasks</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#C7B7A3]"></span> Active Workload</span>
          </div>
        </div>

        {/* Dark Burgundy Workload Insight Panel (Col Span 4) */}
        <div className="lg:col-span-4 card-burgundy-primary p-6 space-y-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-[#E8D8C4]" />
                <h3 className="font-serif text-base font-bold text-white">AI Workload Insight</h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono font-bold text-white">
                Score: {aiInsights?.executiveSummary?.healthScore || 92}/100
              </span>
            </div>

            <div className="space-y-3 mt-3">
              <p className="text-xs text-[#FAF6F0]/90 leading-relaxed">
                {aiInsights?.executiveSummary?.executiveHeadline || 'Capacity optimization algorithm active. Risk parameters within expected limits.'}
              </p>

              {aiInsights?.recommendations?.length > 0 ? (
                <div className="p-3 rounded-xl bg-white/10 border border-white/20 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#E8D8C4]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E8D8C4]" />
                    <span>{aiInsights.recommendations[0].title}</span>
                  </div>
                  <p className="text-[11px] text-white/80">{aiInsights.recommendations[0].message}</p>
                  
                  {aiInsights.recommendations[0].suggestedUser && (
                    <button
                      onClick={() => handleApplyRebalance(aiInsights.recommendations[0])}
                      disabled={rebalancing}
                      className="mt-1 w-full bg-[#FAF6F0] text-[#561C24] hover:bg-white font-bold text-[11px] py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {rebalancing ? 'Applying...' : 'Apply Smart Rebalance'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/10 border border-white/20 text-xs text-[#FAF6F0]/80">
                  No bottleneck warnings currently flagged. Workload evenly distributed across active engineers.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-white/70">
            <span>High Risk Tasks: <strong className="text-white font-mono">{aiInsights?.executiveSummary?.highRiskTasksCount || 0}</strong></span>
            <button onClick={loadDashboardData} className="hover:text-white flex items-center gap-1 cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
