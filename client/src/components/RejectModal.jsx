import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export const RejectModal = ({ isOpen, onClose, onConfirm, task }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(task.id, rejectionReason.trim());
      onClose();
      setRejectionReason('');
    } catch (err) {
      console.error('Reject task error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md rounded-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#F8C8C8] flex items-center justify-between bg-[#FDF2F2]">
          <div className="flex items-center gap-2 text-[#9B2C2C] font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Reject Task</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B5B52] hover:text-[#2C1819] p-1 rounded-lg hover:bg-[#F5EFE6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-[#2C1819] leading-relaxed">
            Rejecting task <span className="font-bold">"{task.title}"</span> submitted by <span className="font-bold text-[#561C24]">{task.creatorName}</span>.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#2C1819] mb-1">
              Reason for Rejection *
            </label>
            <textarea
              rows={4}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="State clear reasons and required changes for the team leader..."
              className="input-field border-[#F8C8C8] focus:border-[#9B2C2C] resize-none rounded-xl"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8D8C4]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rejectionReason.trim()}
              className="btn-danger text-xs rounded-xl"
            >
              {loading ? 'Processing...' : 'Reject Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectModal;
