import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  ShieldAlert, 
  Users, 
  BarChart3, 
  History, 
  Settings,
  LogOut,
  Layers,
  X
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, pendingApprovalsCount = 0, isOpenMobile, onCloseMobile }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks Workspace', icon: CheckSquare },
    { 
      id: 'approvals', 
      label: 'Approvals Queue', 
      icon: ShieldAlert,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      show: user?.role === 'MANAGER' || user?.role === 'LEADER'
    },
    { id: 'teams', label: 'Teams', icon: Users, show: user?.role === 'MANAGER' || user?.role === 'LEADER' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Audit Trail', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#2C1819]/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-50
        w-[250px] bg-[#F6F0E8] border-r border-[#E8D8C4] 
        flex flex-col justify-between h-full shrink-0
        transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          {/* Brand Header */}
          <div className="px-6 py-5 border-b border-[#E8D8C4] flex items-center justify-between bg-[#FAF6F0]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#561C24] flex items-center justify-center text-[#FAF6F0] shadow-sm shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-lg font-serif font-bold text-[#2C1819] tracking-tight leading-tight">
                  TaskFlow
                </h1>
                <p className="text-[11px] text-[#6B5B52] font-medium truncate">Enterprise SaaS</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-[#6B5B52] hover:text-[#2C1819] hover:bg-[#E8D8C4]/50 rounded-lg"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3.5 space-y-1.5 mt-2">
            {navItems.filter(item => item.show !== false).map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#561C24] text-[#FAF6F0] font-semibold shadow-sm'
                      : 'text-[#2C1819] hover:bg-[#E8D8C4]/40 hover:text-[#561C24]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[#FAF6F0]' : 'text-[#6B5B52]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
                      isActive ? 'bg-[#FAF6F0] text-[#561C24]' : 'bg-[#6D2932] text-[#FAF6F0]'
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-[#E8D8C4] space-y-3 bg-[#FAF6F0]">
          <div className="p-3 rounded-xl bg-white border border-[#E8D8C4] flex items-center gap-3 shadow-sm">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={user?.name}
              className="w-9 h-9 rounded-full object-cover border border-[#E8D8C4] shrink-0 avatar-img"
            />
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#2C1819] truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#561C24] text-[#FAF6F0] shrink-0">
                  {user?.role}
                </span>
                <span className="text-[11px] text-[#6B5B52] truncate">{user?.team?.name || 'Global'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#6B5B52] hover:text-[#9B2C2C] hover:bg-[#FDF2F2] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
