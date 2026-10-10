import React, { useState, useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';

export const TaskModal = ({ isOpen, onClose, onSubmit, initialData = null, users = [], teams = [], userRole, userTeamId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [teamId, setTeamId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setPriority(initialData.priority || 'MEDIUM');
      setAssignedTo(initialData.assignedTo || '');
      setTeamId(initialData.teamId || '');
      setDueDate(initialData.dueDate || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      
      if (userRole === 'LEADER' && userTeamId) {
        setTeamId(userTeamId);
        const teamEmployees = users.filter(u => u.teamId === userTeamId && u.role === 'EMPLOYEE');
        if (teamEmployees.length > 0) setAssignedTo(teamEmployees[0].id);
      } else if (users.length > 0) {
        setAssignedTo(users[0].id);
        if (teams.length > 0) setTeamId(teams[0].id);
      }
    }
  }, [initialData, isOpen, users, teams, userRole, userTeamId]);

  if (!isOpen) return null;

  const assignableUsers = userRole === 'LEADER' 
    ? users.filter(u => u.teamId === userTeamId)
    : teamId 
    ? users.filter(u => u.teamId === teamId || u.role !== 'MANAGER')
    : users;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        title,
        description,
        priority,
        assignedTo,
        teamId: userRole === 'LEADER' ? userTeamId : teamId,
        dueDate
      });
      onClose();
    } catch (err) {
      console.error('Submit task error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-lg rounded-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E8D8C4] flex items-center justify-between bg-[#F5EFE6]">
          <h2 className="text-base font-bold text-[#2C1819]">
            {initialData ? 'Edit / Resubmit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#6B5B52] hover:text-[#2C1819] p-1.5 rounded-lg hover:bg-[#E8D8C4]/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Workflow Role Banner */}
          {userRole === 'LEADER' && (
            <div className="p-4 rounded-xl bg-[#FFF8EB] border border-[#F7E3BD] text-xs text-[#A36A00] flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Manager Review Required:</span> Tasks created by Team Leaders are submitted for Manager review prior to execution.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#2C1819]">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement OAuth2 Authentication"
              className="input-field rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#2C1819]">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed explanation of requirements and deliverables..."
              className="input-field resize-none rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#2C1819]">Priority *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input-field rounded-xl"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#2C1819]">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-field rounded-xl"
              />
            </div>
          </div>

          {userRole === 'MANAGER' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#2C1819]">Target Team *</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="input-field rounded-xl"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#2C1819]">Assignee *</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="input-field rounded-xl"
              required
            >
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.title || u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-[#E8D8C4] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs rounded-xl"
            >
              {loading ? 'Saving...' : initialData ? 'Update Task' : userRole === 'LEADER' ? 'Submit for Review' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
