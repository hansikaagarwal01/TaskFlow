import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export const AnalyticsPage = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewData, usersData, tasksData] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/users'),
        api.get('/tasks')
      ]);

      const taskList = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || []);
      const userList = Array.isArray(usersData) ? usersData : [];
      setOverview(overviewData);
      setUsers(userList);
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (loading || !overview) {
    return <div className="p-12 text-center text-xs text-[#6B5B52]">Loading analytics...</div>;
  }

  const { metrics, priorityBreakdown, teamPerformance } = overview;

  // Chart Data with Burgundy, Taupe & Cream Palette
  const priorityChartData = [
    { name: 'High Priority', value: priorityBreakdown.HIGH, color: '#6D2932' },
    { name: 'Medium Priority', value: priorityBreakdown.MEDIUM, color: '#C7B7A3' },
    { name: 'Low Priority', value: priorityBreakdown.LOW, color: '#561C24' }
  ];

  const workloadChartData = users
    .filter(u => u.role === 'EMPLOYEE' || u.role === 'LEADER')
    .map(u => {
      const userTasks = tasks.filter(t => t.assignedTo === u.id);
      return {
        name: u.name,
        activeTasks: userTasks.filter(t => t.status !== 'COMPLETED').length,
        completed: userTasks.filter(t => t.status === 'COMPLETED').length
      };
    });

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E8D8C4]">
        <h1 className="text-xl md:text-2xl font-bold text-[#2C1819] tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#561C24]" />
          Analytics & Performance Intelligence
        </h1>
        <p className="text-xs text-[#6B5B52] mt-0.5">
          Real-time metrics, employee active task distribution, priority breakdowns, and completion velocity.
        </p>
      </div>

      {/* Top Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-beige p-5 rounded-2xl">
          <span className="text-[11px] font-bold text-[#6B5B52] uppercase tracking-wider block">Completion Velocity</span>
          <p className="text-2xl font-extrabold font-mono text-[#2D6A4F] mt-1">{metrics.completionRate}%</p>
        </div>
        <div className="card-beige p-5 rounded-2xl">
          <span className="text-[11px] font-bold text-[#6B5B52] uppercase tracking-wider block">In-Flight Tasks</span>
          <p className="text-2xl font-extrabold font-mono text-[#561C24] mt-1">{metrics.inProgressTasks}</p>
        </div>
        <div className="card-beige p-5 rounded-2xl">
          <span className="text-[11px] font-bold text-[#6B5B52] uppercase tracking-wider block">Pending Review</span>
          <p className="text-2xl font-extrabold font-mono text-[#A36A00] mt-1">{metrics.pendingApprovals}</p>
        </div>
        <div className="card-beige p-5 rounded-2xl">
          <span className="text-[11px] font-bold text-[#6B5B52] uppercase tracking-wider block">Overdue Tasks</span>
          <p className="text-2xl font-extrabold font-mono text-[#9B2C2C] mt-1">{metrics.overdueTasks}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workload Load Distribution Bar Chart */}
        <div className="card-beige p-6 space-y-3 rounded-2xl">
          <h3 className="font-bold text-sm text-[#2C1819]">Employee Workload Distribution</h3>
          <p className="text-xs text-[#6B5B52]">Active vs completed tasks per team member</p>
          
          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadChartData}>
                <XAxis dataKey="name" stroke="#6B5B52" fontSize={11} />
                <YAxis stroke="#6B5B52" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8D8C4', borderRadius: '12px', fontSize: '12px', color: '#2C1819' }}
                />
                <Bar dataKey="activeTasks" name="Active Tasks" fill="#561C24" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed Tasks" fill="#2D6A4F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Classification Pie Chart */}
        <div className="card-beige p-6 space-y-3 rounded-2xl">
          <h3 className="font-bold text-sm text-[#2C1819]">Task Priority Ratio</h3>
          <p className="text-xs text-[#6B5B52]">High, Medium, and Low priority distribution</p>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {priorityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8D8C4', borderRadius: '12px', fontSize: '12px', color: '#2C1819' }}
                />
                <Legend formatter={(value) => <span className="text-xs text-[#2C1819] font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Team Performance Table */}
      {user?.role === 'MANAGER' && teamPerformance.length > 0 && (
        <div className="card-beige p-6 space-y-4 rounded-2xl">
          <h3 className="font-bold text-sm text-[#2C1819]">Department Performance Table</h3>
          
          <div className="table-container">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Department / Team</th>
                  <th>Total Tasks</th>
                  <th>Completed Tasks</th>
                  <th>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {teamPerformance.map(team => (
                  <tr key={team.teamId}>
                    <td className="font-bold text-[#2C1819]">{team.teamName}</td>
                    <td className="font-mono text-[#6B5B52]">{team.totalTasks}</td>
                    <td className="font-mono text-[#2D6A4F] font-bold">{team.completedTasks}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-28 bg-[#F5EFE6] h-2.5 rounded-full overflow-hidden border border-[#E8D8C4]">
                          <div className="bg-[#561C24] h-full rounded-full" style={{ width: `${team.completionRate}%` }}></div>
                        </div>
                        <span className="font-mono text-[#2C1819] font-bold text-xs">{team.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
