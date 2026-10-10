import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Crown, ChevronDown } from 'lucide-react';

export const DemoUserSwitcher = () => {
  const { user, demoLogin, demoUsers, loading } = useAuth();

  const handleChangeRole = (e) => {
    const userId = e.target.value;
    if (userId && userId !== user?.id) {
      demoLogin(userId);
    }
  };

  return (
    <div className="bg-[#FAF6F0] border-b border-[#E8D8C4] px-4 md:px-8 py-2 flex items-center justify-between gap-3 text-xs text-[#2C1819]">
      <div className="flex items-center gap-2 text-[#561C24] font-bold text-xs">
        <Crown className="w-3.5 h-3.5 text-[#561C24] shrink-0" />
        <span className="hidden sm:inline">Development Demo Environment</span>
        <span className="sm:hidden">Demo Env</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[#6B5B52] hidden md:inline font-medium">Switch Role:</span>
        <div className="relative">
          <select
            value={user?.id || ''}
            onChange={handleChangeRole}
            disabled={loading}
            className="input-field py-1 px-3 pr-8 text-xs font-semibold bg-white border-[#E8D8C4] rounded-lg cursor-pointer"
          >
            {demoUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#6B5B52] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default DemoUserSwitcher;
