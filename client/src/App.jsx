import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import { DemoUserSwitcher } from './components/DemoUserSwitcher';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { TeamsPage } from './pages/TeamsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ActivityPage } from './pages/ActivityPage';

import { TaskModal } from './components/TaskModal';
import { RejectModal } from './components/RejectModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { Settings, Shield, Bell, User, Lock } from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  return (
    <div className="page-container space-y-6">
      <div className="pb-4 border-b border-[#E8D8C4]">
        <h1 className="text-xl md:text-2xl font-serif font-bold text-[#2C1819] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#561C24]" />
          Platform Settings & Preferences
        </h1>
        <p className="text-xs text-[#6B5B52] mt-0.5">
          Workspace preferences, notification configurations, and user profile parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-beige p-6 space-y-4 rounded-2xl">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#F0E6D8]">
            <User className="w-4 h-4 text-[#561C24]" />
            <h3 className="font-serif text-base font-bold text-[#2C1819]">User Profile & Role</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#6B5B52] uppercase">Full Name</label>
              <p className="font-bold text-[#2C1819] text-sm mt-0.5">{user?.name}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B5B52] uppercase">Email Address</label>
              <p className="font-mono text-[#2C1819] mt-0.5">{user?.email}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B5B52] uppercase">Access Role</label>
              <span className="inline-block mt-1 px-2.5 py-1 text-xs font-bold rounded-md bg-[#561C24] text-[#FAF6F0]">
                {user?.role} — {user?.team?.name || 'Global Organization'}
              </span>
            </div>
          </div>
        </div>

        <div className="card-beige p-6 space-y-4 rounded-2xl">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#F0E6D8]">
            <Bell className="w-4 h-4 text-[#561C24]" />
            <h3 className="font-serif text-base font-bold text-[#2C1819]">Notification Preferences</h3>
          </div>
          <div className="space-y-3 text-xs text-[#2C1819]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#561C24] w-4 h-4 rounded" />
              <span>Email notifications on task approval/rejection</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#561C24] w-4 h-4 rounded" />
              <span>AI Workload bottleneck alert digests</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#561C24] w-4 h-4 rounded" />
              <span>Due date reminder notifications</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MainLayout = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auxiliary data for modals
  const [allUsers, setAllUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Modal Control States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingTask, setRejectingTask] = useState(null);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchAuxiliaryData = async () => {
    if (!user) return;
    try {
      const [usersData, teamsData, approvalsData] = await Promise.all([
        api.get('/users'),
        api.get('/teams'),
        (user?.role === 'MANAGER' || user?.role === 'LEADER') ? api.get('/approvals') : Promise.resolve([])
      ]);

      setAllUsers(usersData);
      setAllTeams(teamsData);
      setPendingApprovalsCount(approvalsData.length);
    } catch (err) {
      console.error('Failed to fetch aux data:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliaryData();
  }, [user]);

  // Handlers
  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenResubmitModal = (task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenRejectModal = (task) => {
    setRejectingTask(task);
    setIsRejectModalOpen(true);
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleCreateOrUpdateTask = async (taskPayload) => {
    if (editingTask) {
      await api.put(`/tasks/${editingTask.id}`, taskPayload);
    } else {
      await api.post('/tasks', taskPayload);
    }
    fetchAuxiliaryData();
  };

  const handleConfirmReject = async (taskId, rejectionReason) => {
    await api.post(`/approvals/${taskId}/reject`, { rejectionReason });
    fetchAuxiliaryData();
  };

  // Map active tab to page title
  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'tasks': return 'Tasks Workspace';
      case 'approvals': return 'Approvals Queue';
      case 'teams': return 'Organization Teams';
      case 'analytics': return 'Analytics Intelligence';
      case 'activity': return 'Audit Trail';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF6F0] text-[#2C1819]">
      {/* Development Demo Control Toolbar */}
      <DemoUserSwitcher />

      {/* Main SaaS Layout Shell */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar (250px) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalsCount={pendingApprovalsCount}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {/* Header */}
          <Navbar
            pageTitle={getPageTitle()}
            search={search}
            setSearch={setSearch}
            onOpenCreateTask={handleOpenCreateTask}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          />

          {/* Page Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'dashboard' && (
              <DashboardPage
                onNavigateTab={setActiveTab}
                onSelectTask={handleSelectTask}
                onOpenRejectModal={handleOpenRejectModal}
                onOpenResubmitModal={handleOpenResubmitModal}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksPage
                search={search}
                setSearch={setSearch}
                onOpenCreateTask={handleOpenCreateTask}
                onSelectTask={handleSelectTask}
                onOpenRejectModal={handleOpenRejectModal}
                onOpenResubmitModal={handleOpenResubmitModal}
              />
            )}

            {activeTab === 'approvals' && (
              <ApprovalsPage
                onSelectTask={handleSelectTask}
                onOpenRejectModal={handleOpenRejectModal}
                onOpenResubmitModal={handleOpenResubmitModal}
              />
            )}

            {activeTab === 'teams' && <TeamsPage />}

            {activeTab === 'analytics' && <AnalyticsPage />}

            {activeTab === 'activity' && <ActivityPage />}

            {activeTab === 'settings' && <SettingsPage />}
          </main>
        </div>
      </div>

      {/* Floating Toasts */}
      <ToastContainer />

      {/* Create / Edit Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateOrUpdateTask}
        initialData={editingTask}
        users={allUsers}
        teams={allTeams}
        userRole={user?.role}
        userTeamId={user?.teamId}
      />

      {/* Reject Task Modal */}
      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
        task={rejectingTask}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        userRole={user?.role}
        currentUserId={user?.id}
        onUpdateStatus={async (taskId, newStatus) => {
          await api.put(`/tasks/${taskId}/status`, { status: newStatus });
          fetchAuxiliaryData();
        }}
        onApprove={async (taskId) => {
          await api.post(`/approvals/${taskId}/approve`);
          fetchAuxiliaryData();
        }}
        onReject={handleOpenRejectModal}
        onResubmit={handleOpenResubmitModal}
      />
    </div>
  );
};

export const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#6B5B52] flex items-center justify-center text-xs">
        Initializing TaskFlow Session...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

export default App;
