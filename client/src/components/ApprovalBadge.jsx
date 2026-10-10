import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

export const ApprovalBadge = ({ status }) => {
  switch (status) {
    case 'PENDING_APPROVAL':
      return (
        <span className="badge badge-pending_approval">
          <AlertTriangle className="w-3 h-3 text-[#9A7946]" />
          Pending Review
        </span>
      );
    case 'APPROVED':
      return (
        <span className="badge badge-approved">
          <CheckCircle className="w-3 h-3 text-[#5F8065]" />
          Approved
        </span>
      );
    case 'REJECTED':
      return (
        <span className="badge badge-rejected">
          <XCircle className="w-3 h-3 text-[#9A5C55]" />
          Rejected
        </span>
      );
    case 'NOT_REQUIRED':
      return (
        <span className="badge badge-not_required">
          <MinusCircle className="w-3 h-3 text-[#6F6A63]" />
          Auto-Approved
        </span>
      );
    default:
      return <span className="badge badge-not_required">{status}</span>;
  }
};

export default ApprovalBadge;
