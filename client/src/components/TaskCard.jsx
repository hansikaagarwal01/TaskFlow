import React from 'react';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { ApprovalBadge } from './ApprovalBadge';
import { Calendar, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

export const TaskCard = ({ task, userRole, currentUserId, onSelectTask, onUpdateStatus, onApprove, onReject, onResubmit }) => {
  const isOverdue = task.status !== 'COMPLETED' && new Date(task.dueDate) < new Date();
  const isPendingApproval = task.approvalStatus === 'PENDING_APPROVAL';
  const isRejected = task.approvalStatus === 'REJECTED';

  return (
    <div
      onClick={() => onSelectTask(task)}
      className="card-beige card-beige-hover p-6 relative cursor-pointer flex flex-col justify-between space-y-5 rounded-2xl"
    >
      <div>
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <PriorityBadge priority={task.priority} />
          <ApprovalBadge status={task.approvalStatus} />
        </div>

        {/* Task Title */}
        <h3 className="font-bold text-base text-[#2C1819] mb-2 line-clamp-2 leading-snug hover:text-[#561C24] transition-colors">
          {task.title}
        </h3>

        {/* Short Description */}
        <p className="text-xs text-[#6B5B52] line-clamp-2 leading-relaxed">
          {task.description}
        </p>

        {/* Rejection Warning Banner */}
        {isRejected && task.rejectionReason && (
          <div className="mt-3 p-3 rounded-xl bg-[#FDF2F2] border border-[#F8C8C8] text-xs text-[#9B2C2C]">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#9B2C2C]" />
              <span>Manager Feedback:</span>
            </div>
            <p className="italic text-xs line-clamp-2 leading-relaxed">{task.rejectionReason}</p>
          </div>
        )}
      </div>

      <div>
        {/* Task Footer Meta (Assignee & Due Date) */}
        <div className="pt-4 border-t border-[#F0E6D8] flex items-center justify-between text-xs text-[#6B5B52] mb-4">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <img
              src={task.assigneeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={task.assigneeName}
              className="w-6 h-6 rounded-full object-cover border border-[#E8D8C4] shrink-0"
            />
            <span className="truncate font-medium text-[#2C1819]">{task.assigneeName}</span>
          </div>

          <div className={`flex items-center gap-1.5 font-mono text-xs shrink-0 ${isOverdue ? 'text-[#9B2C2C] font-bold' : ''}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{task.dueDate}</span>
          </div>
        </div>

        {/* Interactive Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={task.status} />

          {/* MANAGER Actions for Pending Approval Tasks */}
          {userRole === 'MANAGER' && isPendingApproval && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApprove(task.id)}
                className="btn-success text-xs py-1.5 px-3 rounded-lg"
                title="Approve Task"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(task)}
                className="btn-danger text-xs py-1.5 px-3 rounded-lg"
                title="Reject Task"
              >
                Reject
              </button>
            </div>
          )}

          {/* LEADER Action for Rejected Tasks */}
          {userRole === 'LEADER' && isRejected && task.createdBy === currentUserId && (
            <button
              onClick={() => onResubmit(task)}
              className="btn-primary text-xs py-1.5 px-3 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Edit & Resubmit</span>
            </button>
          )}

          {/* EMPLOYEE Action for Active Tasks */}
          {task.assignedTo === currentUserId && task.approvalStatus !== 'PENDING_APPROVAL' && task.approvalStatus !== 'REJECTED' && (
            <div>
              {task.status === 'PENDING' && (
                <button
                  onClick={() => onUpdateStatus(task.id, 'IN_PROGRESS')}
                  className="btn-primary text-xs py-1.5 px-3 rounded-lg"
                >
                  Start Work
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => onUpdateStatus(task.id, 'COMPLETED')}
                  className="btn-success text-xs py-1.5 px-3 rounded-lg"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Complete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
