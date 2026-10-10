import React from 'react';
import { AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export const PriorityBadge = ({ priority }) => {
  switch (priority) {
    case 'HIGH':
      return (
        <span className="badge badge-high">
          <ArrowUp className="w-3 h-3 text-[#9A5C55]" />
          High
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="badge badge-medium">
          <Minus className="w-3 h-3 text-[#7A5E35]" />
          Medium
        </span>
      );
    case 'LOW':
      return (
        <span className="badge badge-low">
          <ArrowDown className="w-3 h-3 text-[#555048]" />
          Low
        </span>
      );
    default:
      return <span className="badge badge-low">{priority}</span>;
  }
};

export default PriorityBadge;
