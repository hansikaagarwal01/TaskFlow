import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Bell, Plus, Search, Menu, MessageSquare, ChevronDown, User, Shield, LogOut } from 'lucide-react';

export const Navbar = ({ pageTitle = 'Dashboard', search, setSearch, onOpenCreateTask, onToggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="bg-[#FAF6F0]/90 backdrop-blur-md border-b border-[#E8D8C4] px-4 md:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-[#6B5B52] hover:text-[#2C1819] hover:bg-[#F6F0E8] rounded-xl shrink-0 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg md:text-xl font-serif font-bold text-[#2C1819] tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="relative flex-1 max-w-xs md:max-w-md hidden sm:block mx-4">
        <Search className="w-4 h-4 text-[#8F7E75] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks, teams, assignees..."
          className="input-field input-field-icon-left py-2 text-xs rounded-xl bg-white border-[#E8D8C4] focus:border-[#561C24]"
        />
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Create Task Button (Manager or Leader) */}
        {user?.role !== 'EMPLOYEE' && (
          <button
            onClick={onOpenCreateTask}
            className="btn-primary text-xs py-2 px-3.5 rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Task</span>
          </button>
        )}

        {/* Messages Quick Trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowMessages(!showMessages);
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}
            className="p-2.5 rounded-xl bg-white text-[#6B5B52] hover:text-[#561C24] hover:bg-[#F6F0E8] border border-[#E8D8C4] relative cursor-pointer transition-colors shadow-sm"
            aria-label="Messages"
            title="Team Activity & Messages"
          >
            <MessageSquare className="w-4.5 h-4.5" />
          </button>

          {showMessages && (
            <div className="absolute right-0 mt-3 w-72 bg-white border border-[#E8D8C4] rounded-2xl shadow-xl z-50 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8D8C4]">
                <span className="font-bold text-xs text-[#2C1819]">Team Dispatch Messages</span>
                <span className="text-[10px] font-mono text-[#2D6A4F] bg-[#F0F7F2] px-2 py-0.5 rounded-md font-semibold">Active</span>
              </div>
              <div className="space-y-2.5 text-xs text-[#6B5B52]">
                <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4]">
                  <p className="font-semibold text-[#2C1819]">Alex Rivera (Leader)</p>
                  <p className="text-[11px] mt-0.5">Updated Security Auth module specs.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4]">
                  <p className="font-semibold text-[#2C1819]">David Kim (Employee)</p>
                  <p className="text-[11px] mt-0.5">Completed API documentation review.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Dropdown Toggle */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowMessages(false);
              setShowProfileMenu(false);
            }}
            className="p-2.5 rounded-xl bg-white text-[#6B5B52] hover:text-[#561C24] hover:bg-[#F6F0E8] border border-[#E8D8C4] relative cursor-pointer transition-colors shadow-sm"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#561C24] text-[#FAF6F0] rounded-full text-[10px] font-bold flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Modal */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white border border-[#E8D8C4] rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="p-4 border-b border-[#E8D8C4] flex items-center justify-between bg-[#F6F0E8]">
                <span className="text-xs font-bold text-[#2C1819]">Notifications ({notifications.length})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-[#561C24] hover:underline cursor-pointer font-bold"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#F0E6D8]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8F7E75]">
                    No recent notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-4 text-xs cursor-pointer transition-colors ${
                        n.isRead ? 'bg-white opacity-70' : 'bg-[#FAF6F0] hover:bg-[#F6F0E8] border-l-4 border-[#561C24]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-[#2C1819]">{n.title}</span>
                        <span className="text-[10px] text-[#8F7E75] shrink-0">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[#6B5B52] mt-1.5 line-clamp-2 text-xs leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
              setShowMessages(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-[#E8D8C4] shadow-sm hover:border-[#C7B7A3] cursor-pointer"
          >
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={user?.name}
              className="w-7 h-7 rounded-full object-cover border border-[#E8D8C4]"
            />
            <span className="text-xs font-semibold text-[#2C1819] hidden md:inline truncate max-w-[100px]">{user?.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B5B52] hidden md:inline" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 bg-white border border-[#E8D8C4] rounded-2xl shadow-xl z-50 p-3 space-y-2">
              <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4]">
                <p className="text-xs font-bold text-[#2C1819] truncate">{user?.name}</p>
                <p className="text-[11px] text-[#6B5B52] truncate mt-0.5">{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#561C24] text-[#FAF6F0]">
                  {user?.role} — {user?.team?.name || 'Global'}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#9B2C2C] hover:bg-[#FDF2F2] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
