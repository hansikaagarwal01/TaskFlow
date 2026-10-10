import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { TaskCard } from '../components/TaskCard';
import { 
  Filter, 
  Plus, 
  LayoutGrid, 
  Kanban, 
  Clock, 
  PlayCircle, 
  CheckCircle2,
  FileX
} from 'lucide-react';

export const TasksPage = ({ search, setSearch, onOpenCreateTask, onSelectTask, onOpenRejectModal, onOpenResubmitModal }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');

  // Filter States
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filterPriority) queryParams.append('priority', filterPriority);
      if (filterStatus) queryParams.append('status', filterStatus);
      if (filterApprovalStatus) queryParams.append('approvalStatus', filterApprovalStatus);
      if (search) queryParams.append('search', search);

      const data = await api.get(`/tasks?${queryParams.toString()}`);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filterPriority, filterStatus, filterApprovalStatus, search, user]);

  const handleApprove = async (taskId) => {
    try {
      await api.post(`/approvals/${taskId}/approve`);
      loadTasks();
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      loadTasks();
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return (
    <div className="page-container space-y-8">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E8D8C4]">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold text-[#2C1819] tracking-tight">
            Tasks Workspace
          </h1>
          <p className="text-xs text-[#6B5B52] leading-relaxed">
            {user?.role === 'MANAGER' 
              ? 'Organization task workflow board — Overview across all departments.'
              : user?.role === 'LEADER'
              ? `Department task board — Managing tasks for ${user?.team?.name || 'assigned team'}.`
              : 'Personal tasks workspace — Viewing and updating your assigned work.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#F5EFE6] border border-[#E8D8C4] p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'kanban' ? 'bg-white text-[#561C24] font-bold shadow-sm border border-[#E8D8C4]' : 'text-[#6B5B52] hover:text-[#2C1819]'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-white text-[#561C24] font-bold shadow-sm border border-[#E8D8C4]' : 'text-[#6B5B52] hover:text-[#2C1819]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grid</span>
            </button>
          </div>

          {/* Create Task Button */}
          {user?.role !== 'EMPLOYEE' && (
            <button onClick={onOpenCreateTask} className="btn-primary text-xs py-2 px-4 rounded-xl">
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-beige p-5 flex flex-wrap items-center gap-4 text-xs rounded-2xl">
        <div className="flex items-center gap-2 text-[#6B5B52] font-bold shrink-0">
          <Filter className="w-4 h-4 text-[#561C24]" />
          <span>Filters:</span>
        </div>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="input-field py-1.5 px-3 w-auto min-w-[140px] rounded-xl"
        >
          <option value="">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field py-1.5 px-3 w-auto min-w-[140px] rounded-xl"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>

        {/* Approval Status Filter */}
        <select
          value={filterApprovalStatus}
          onChange={(e) => setFilterApprovalStatus(e.target.value)}
          className="input-field py-1.5 px-3 w-auto min-w-[160px] rounded-xl"
        >
          <option value="">All Approval States</option>
          <option value="PENDING_APPROVAL">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="NOT_REQUIRED">Auto-Approved</option>
        </select>

        {(filterPriority || filterStatus || filterApprovalStatus || search) && (
          <button
            onClick={() => {
              setFilterPriority('');
              setFilterStatus('');
              setFilterApprovalStatus('');
              setSearch('');
            }}
            className="text-xs text-[#561C24] hover:underline ml-auto cursor-pointer font-bold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Task Views */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(col => (
            <div key={col} className="bg-[#F5EFE6] p-5 rounded-2xl border border-[#E8D8C4] space-y-4">
              <div className="h-6 bg-[#E8D8C4] rounded-lg w-1/3 animate-pulse"></div>
              <div className="h-32 bg-white rounded-2xl border border-[#E8D8C4] animate-pulse"></div>
              <div className="h-32 bg-white rounded-2xl border border-[#E8D8C4] animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card-beige p-12 text-center max-w-md mx-auto my-12 space-y-4 rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-[#F5EFE6] border border-[#E8D8C4] flex items-center justify-center mx-auto text-[#6B5B52]">
            <FileX className="w-7 h-7 text-[#561C24]" />
          </div>
          <h3 className="text-base font-bold text-[#2C1819]">No tasks found</h3>
          <p className="text-xs text-[#6B5B52]">
            There are currently no tasks matching your filters or team scope.
          </p>
          {user?.role !== 'EMPLOYEE' && (
            <div className="pt-2">
              <button onClick={onOpenCreateTask} className="btn-primary text-xs py-2 px-4 rounded-xl">
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PENDING COLUMN */}
          <div className="bg-[#F5EFE6] p-5 rounded-2xl border border-[#E8D8C4] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D8C4]">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-[#561C24]" />
                <h3 className="font-bold text-xs text-[#2C1819] uppercase tracking-wider">Pending</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-white text-[#561C24] border border-[#E8D8C4] font-mono text-xs font-bold shadow-sm">
                {pendingTasks.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[400px]">
              {pendingTasks.map(task => (
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
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="bg-[#F5EFE6] p-5 rounded-2xl border border-[#E8D8C4] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D8C4]">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4.5 h-4.5 text-[#6D2932]" />
                <h3 className="font-bold text-xs text-[#2C1819] uppercase tracking-wider">In Progress</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-white text-[#6D2932] border border-[#E8D8C4] font-mono text-xs font-bold shadow-sm">
                {inProgressTasks.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[400px]">
              {inProgressTasks.map(task => (
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
          </div>

          {/* COMPLETED COLUMN */}
          <div className="bg-[#F5EFE6] p-5 rounded-2xl border border-[#E8D8C4] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D8C4]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-[#2D6A4F]" />
                <h3 className="font-bold text-xs text-[#2C1819] uppercase tracking-wider">Completed</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-white text-[#2D6A4F] border border-[#C8E6C9] font-mono text-xs font-bold shadow-sm">
                {completedTasks.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[400px]">
              {completedTasks.map(task => (
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
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
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
  );
};

export default TasksPage;
