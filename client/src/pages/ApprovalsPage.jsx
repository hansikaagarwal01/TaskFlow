import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ShieldAlert, RotateCcw, User, Calendar, AlertTriangle } from 'lucide-react';
import { PriorityBadge } from '../components/PriorityBadge';

export const ApprovalsPage = ({ onSelectTask, onOpenRejectModal, onOpenResubmitModal }) => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [rejectedTasks, setRejectedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApprovalsData = async () => {
    try {
      setLoading(true);
      const [pendingData, allTasksData] = await Promise.all([
        api.get('/approvals'),
        api.get('/tasks')
      ]);

      setPendingApprovals(pendingData);
      setRejectedTasks(allTasksData.filter(t => t.approvalStatus === 'REJECTED'));
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovalsData();
  }, [user]);

  const handleApprove = async (taskId) => {
    try {
      await api.post(`/approvals/${taskId}/approve`);
      loadApprovalsData();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#6B5B52]">Loading task approval queue...</div>;
  }

  return (
    <div className="page-container space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-[#E8D8C4]">
        <h1 className="text-xl md:text-2xl font-bold text-[#2C1819] tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#561C24]" />
          Approvals Workspace
        </h1>
        <p className="text-xs text-[#6B5B52] mt-0.5">
          {user?.role === 'MANAGER'
            ? 'Review and approve or reject tasks created by Team Leaders before work begins.'
            : 'Track review status for tasks submitted for Manager approval.'}
        </p>
      </div>

      {/* Pending Approvals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#2C1819] flex items-center gap-2">
            <span>Pending Manager Approvals</span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#FFF8EB] text-[#A36A00] border border-[#F7E3BD] font-mono text-xs font-bold">
              {pendingApprovals.length}
            </span>
          </h2>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="card-beige p-8 text-center text-xs text-[#6B5B52] rounded-2xl">
            No tasks currently awaiting approval. All submissions are up to date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pendingApprovals.map(task => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="card-beige card-beige-hover p-5 flex flex-col justify-between space-y-4 cursor-pointer rounded-2xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <PriorityBadge priority={task.priority} />
                    <span className="text-[11px] font-mono text-[#6B5B52]">Created by <strong className="text-[#2C1819]">{task.creatorName}</strong></span>
                  </div>

                  <h3 className="font-bold text-base text-[#2C1819] mb-1.5 hover:text-[#561C24] transition-colors">
                    {task.title}
                  </h3>

                  <p className="text-xs text-[#6B5B52] line-clamp-3 mb-3">
                    {task.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#F0E6D8] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[#6B5B52]">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[#2C1819] font-medium">{task.assigneeName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#6B5B52] font-mono text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{task.dueDate}</span>
                    </div>
                  </div>

                  {user?.role === 'MANAGER' ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                  ) : (
                    <span className="badge badge-pending_approval">Awaiting Review</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejected Tasks Queue */}
      <div className="space-y-4 pt-4 border-t border-[#E8D8C4]">
        <h2 className="text-base font-bold text-[#2C1819] flex items-center gap-2">
          <span>Rejected Tasks Needing Revision</span>
          <span className="px-2.5 py-0.5 rounded-md bg-[#FDF2F2] text-[#9B2C2C] border border-[#F8C8C8] font-mono text-xs font-bold">
            {rejectedTasks.length}
          </span>
        </h2>

        {rejectedTasks.length === 0 ? (
          <div className="card-beige p-8 text-center text-xs text-[#6B5B52] rounded-2xl">
            No rejected tasks pending revision.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rejectedTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="card-beige p-5 border-[#F8C8C8] bg-[#FDF2F2]/40 flex flex-col justify-between space-y-4 cursor-pointer rounded-2xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <PriorityBadge priority={task.priority} />
                    <span className="badge badge-rejected">Rejected</span>
                  </div>

                  <h3 className="font-bold text-base text-[#2C1819] mb-1.5">{task.title}</h3>

                  <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F8C8C8] text-xs text-[#9B2C2C] my-2">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#9B2C2C]" />
                      <span>Rejection Reason:</span>
                    </div>
                    <p className="italic text-[11px]">{task.rejectionReason}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F8C8C8] flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[#6B5B52]">Created by <strong className="text-[#2C1819]">{task.creatorName}</strong></span>

                  {(user?.role === 'LEADER' && task.createdBy === user?.id) || user?.role === 'MANAGER' ? (
                    <button
                      onClick={() => onOpenResubmitModal(task)}
                      className="btn-primary text-xs py-1.5 px-3 rounded-lg"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Edit & Resubmit</span>
                    </button>
                  ) : (
                    <span className="text-xs text-[#9B2C2C] font-bold">Requires Leader Revision</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalsPage;
