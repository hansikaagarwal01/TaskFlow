import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { ApprovalBadge } from './ApprovalBadge';
import { X, Calendar, User, AlertCircle, RotateCcw, CheckCircle2, History, Users, Layers } from 'lucide-react';

export const TaskDetailModal = ({ isOpen, onClose, task, userRole, currentUserId, onUpdateStatus, onApprove, onReject, onResubmit }) => {
  const [taskDetails, setTaskDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!task) return;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/tasks/${task.id}`);
        setTaskDetails(data);
      } catch (err) {
        console.error('Failed to load task details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const displayTask = taskDetails || task;

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-3xl max-h-[90vh] flex flex-col rounded-2xl">
        {/* Header */}
        <div className="px-6 py-5 sm:px-8 border-b border-[#E8D8C4] flex items-center justify-between bg-[#F5EFE6] shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <PriorityBadge priority={displayTask.priority} />
            <ApprovalBadge status={displayTask.approvalStatus} />
          </div>
          <button onClick={onClose} className="text-[#6B5B52] hover:text-[#2C1819] p-1.5 rounded-lg hover:bg-[#E8D8C4]/50 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Title & Description */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#2C1819] leading-snug">{displayTask.title}</h2>
            <p className="text-[#6B5B52] text-sm leading-relaxed whitespace-pre-line">
              {displayTask.description || 'No detailed description provided.'}
            </p>
          </div>

          {/* Rejection Feedback Box */}
          {displayTask.approvalStatus === 'REJECTED' && displayTask.rejectionReason && (
            <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F8C8C8] text-[#9B2C2C] space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-[#9B2C2C] shrink-0" />
                <span>Rejection Feedback:</span>
              </div>
              <p className="italic text-xs leading-relaxed">{displayTask.rejectionReason}</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-[#F5EFE6] border border-[#E8D8C4]">
            <div className="space-y-1">
              <span className="text-[10px] text-[#8F7E75] uppercase font-bold block">Assignee</span>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#6B5B52]" />
                <span className="font-bold text-xs text-[#2C1819]">{displayTask.assigneeName}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#8F7E75] uppercase font-bold block">Created By</span>
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#6B5B52]" />
                <span className="font-bold text-xs text-[#2C1819]">{displayTask.creatorName}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#8F7E75] uppercase font-bold block">Team</span>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#561C24]" />
                <span className="font-bold text-xs text-[#561C24]">{displayTask.teamName}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#8F7E75] uppercase font-bold block">Due Date</span>
              <div className="flex items-center gap-2 font-mono">
                <Calendar className="w-3.5 h-3.5 text-[#6B5B52]" />
                <span className="font-bold text-xs text-[#2C1819]">{displayTask.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Activity Audit Stream */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-xs text-[#2C1819] uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#561C24]" />
              <span>Activity & Audit Trail</span>
            </h3>

            {loading ? (
              <p className="text-[#8F7E75] text-xs">Loading activity history...</p>
            ) : displayTask.activityHistory && displayTask.activityHistory.length > 0 ? (
              <div className="space-y-2.5 bg-white p-4 rounded-xl border border-[#E8D8C4] max-h-48 overflow-y-auto">
                {displayTask.activityHistory.map(log => (
                  <div key={log.id} className="text-xs text-[#6B5B52] border-b border-[#F0E6D8] pb-2 last:border-0">
                    <span className="text-[#2C1819] font-medium leading-normal">{log.details}</span>
                    <span className="text-[10px] text-[#8F7E75] block font-mono mt-1">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#8F7E75] text-xs">No activity logged yet.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 sm:px-8 border-t border-[#E8D8C4] flex flex-wrap items-center justify-between gap-4 bg-[#F5EFE6] shrink-0">
          <StatusBadge status={displayTask.status} />

          <div className="flex items-center gap-3">
            {/* MANAGER Actions */}
            {userRole === 'MANAGER' && displayTask.approvalStatus === 'PENDING_APPROVAL' && (
              <>
                <button
                  onClick={() => {
                    onApprove(displayTask.id);
                    onClose();
                  }}
                  className="btn-success text-xs py-2 px-4 rounded-xl"
                >
                  Approve Task
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onReject(displayTask);
                  }}
                  className="btn-danger text-xs py-2 px-4 rounded-xl"
                >
                  Reject Task
                </button>
              </>
            )}

            {/* LEADER Action */}
            {userRole === 'LEADER' && displayTask.approvalStatus === 'REJECTED' && displayTask.createdBy === currentUserId && (
              <button
                onClick={() => {
                  onClose();
                  onResubmit(displayTask);
                }}
                className="btn-primary text-xs py-2 px-4 rounded-xl"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Edit & Resubmit</span>
              </button>
            )}

            {/* EMPLOYEE Action */}
            {displayTask.assignedTo === currentUserId && displayTask.approvalStatus !== 'PENDING_APPROVAL' && displayTask.approvalStatus !== 'REJECTED' && (
              <>
                {displayTask.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      onUpdateStatus(displayTask.id, 'IN_PROGRESS');
                      onClose();
                    }}
                    className="btn-primary text-xs py-2 px-4 rounded-xl"
                  >
                    Start Work
                  </button>
                )}
                {displayTask.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => {
                      onUpdateStatus(displayTask.id, 'COMPLETED');
                      onClose();
                    }}
                    className="btn-success text-xs py-2 px-4 rounded-xl"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Completed</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
