import React from 'react';
import { Clock, PlayCircle, CheckCircle2 } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className="badge badge-pending">
          <Clock className="w-3 h-3 text-[#8A733B]" />
          Pending
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="badge badge-in_progress">
          <PlayCircle className="w-3 h-3 text-[#6E553A]" />
          In Progress
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="badge badge-completed">
          <CheckCircle2 className="w-3 h-3 text-[#5F8065]" />
          Completed
        </span>
      );
    default:
      return <span className="badge badge-pending">{status}</span>;
  }
};

export default StatusBadge;
