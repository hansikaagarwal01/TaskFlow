import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { History, Clock, Activity } from 'lucide-react';

export const ActivityPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.get('/activity');
      setLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const getActionBadge = (action) => {
    switch (action) {
      case 'APPROVED':
        return <span className="badge badge-approved">Approved</span>;
      case 'REJECTED':
        return <span className="badge badge-rejected">Rejected</span>;
      case 'SUBMITTED_FOR_APPROVAL':
        return <span className="badge badge-pending_approval">Submitted</span>;
      case 'STATUS_CHANGED':
        return <span className="badge badge-in_progress">Status Change</span>;
      case 'RESUBMITTED':
        return <span className="badge badge-medium">Resubmitted</span>;
      case 'REASSIGNED_BY_AI':
        return <span className="badge badge-high">Reassigned</span>;
      default:
        return <span className="badge badge-not_required">{action}</span>;
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#6B5B52]">Loading organizational audit trail logs...</div>;
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E8D8C4]">
        <h1 className="text-xl md:text-2xl font-bold text-[#2C1819] tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-[#561C24]" />
          Audit Trail & Activity Stream
        </h1>
        <p className="text-xs text-[#6B5B52] mt-0.5">
          Centralized event audit stream tracking task creations, manager approval reviews, status changes, and reassignment logs.
        </p>
      </div>

      {/* Log Feed Stream */}
      <div className="card-beige p-6 space-y-4 rounded-2xl">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#6B5B52]">
            No activity logged yet.
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-[#E8D8C4]">
            {logs.map(log => (
              <div key={log.id} className="relative pl-9 flex items-start justify-between gap-4 text-xs">
                {/* User Avatar Badge Dot */}
                <div className="absolute left-1.5 top-0.5 w-6 h-6 rounded-full bg-[#F5EFE6] border border-[#E8D8C4] flex items-center justify-center text-[10px] text-[#561C24] shadow-sm">
                  <Activity className="w-3 h-3 text-[#561C24]" />
                </div>

                <div className="flex-1 bg-white p-4 rounded-xl border border-[#E8D8C4] shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#2C1819]">{log.userName}</span>
                      <span className="text-[10px] font-mono text-[#6B5B52]">({log.userRole})</span>
                    </div>
                    {getActionBadge(log.action)}
                  </div>

                  <p className="text-[#6B5B52] text-xs mt-1 leading-relaxed">{log.details}</p>

                  <div className="mt-2 text-[10px] text-[#8F7E75] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
