import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const TeamModal = ({ isOpen, onClose, onSubmit, initialData = null, users = [] }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setLeaderId(initialData.leaderId || '');
    } else {
      setName('');
      setDescription('');
      if (users.length > 0) setLeaderId(users[0].id);
    }
  }, [initialData, isOpen, users]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ name, description, leaderId });
      onClose();
    } catch (err) {
      console.error('Submit team error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md rounded-2xl">
        <div className="px-6 py-4 border-b border-[#E8D8C4] flex items-center justify-between bg-[#F5EFE6]">
          <h2 className="text-base font-bold text-[#2C1819]">
            {initialData ? 'Edit Team Details' : 'Create New Team'}
          </h2>
          <button onClick={onClose} className="text-[#6B5B52] hover:text-[#2C1819] p-1 rounded-lg hover:bg-[#E8D8C4]/50 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#2C1819] mb-1">Team Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quality Assurance & Testing"
              className="input-field rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2C1819] mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of department scope..."
              className="input-field resize-none rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2C1819] mb-1">Team Leader *</label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="input-field rounded-xl"
              required
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role} - {u.title || 'No Title'})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8D8C4]">
            <button type="button" onClick={onClose} className="btn-secondary text-xs rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs rounded-xl">
              {loading ? 'Saving...' : initialData ? 'Update Team' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamModal;
