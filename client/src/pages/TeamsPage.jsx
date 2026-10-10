import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { TeamModal } from '../components/TeamModal';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';

export const TeamsPage = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const loadTeamsData = async () => {
    try {
      setLoading(true);
      const [teamsData, usersData] = await Promise.all([
        api.get('/teams'),
        api.get('/users')
      ]);

      setTeams(teamsData);
      setAllUsers(usersData);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamsData();
  }, [user]);

  const handleCreateOrUpdateTeam = async (teamData) => {
    if (editingTeam) {
      await api.put(`/teams/${editingTeam.id}`, teamData);
    } else {
      await api.post('/teams', teamData);
    }
    loadTeamsData();
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? Members will be unassigned.')) return;
    try {
      await api.delete(`/teams/${teamId}`);
      loadTeamsData();
    } catch (err) {
      console.error('Delete team failed:', err);
    }
  };

  const handleReassignUserTeam = async (userId, newTeamId) => {
    try {
      await api.put(`/users/${userId}/team`, { teamId: newTeamId });
      loadTeamsData();
    } catch (err) {
      console.error('User team update failed:', err);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#6B5B52]">Loading organization teams...</div>;
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8D8C4]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#2C1819] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#561C24]" />
            Organization Teams
          </h1>
          <p className="text-xs text-[#6B5B52] mt-0.5">
            Department structure, leadership assignments, team members, and workload metrics.
          </p>
        </div>

        {user?.role === 'MANAGER' && (
          <button
            onClick={() => {
              setEditingTeam(null);
              setIsModalOpen(true);
            }}
            className="btn-primary text-xs rounded-xl"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        )}
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map(team => (
          <div key={team.id} className="card-beige p-6 flex flex-col justify-between space-y-5 rounded-2xl">
            <div>
              {/* Team Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-bold text-lg text-[#2C1819]">{team.name}</h2>
                  <p className="text-xs text-[#6B5B52] mt-0.5">{team.description}</p>
                </div>

                {user?.role === 'MANAGER' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTeam(team);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-[#6B5B52] hover:text-[#561C24] hover:bg-[#F5EFE6]"
                      title="Edit Team"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-1.5 rounded-lg text-[#6B5B52] hover:text-[#9B2C2C] hover:bg-[#FDF2F2]"
                      title="Delete Team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Team Leader Banner */}
              {team.leader ? (
                <div className="p-3.5 rounded-xl bg-[#F5EFE6] border border-[#E8D8C4] flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={team.leader.avatar}
                      alt={team.leader.name}
                      className="w-9 h-9 rounded-full object-cover border border-[#E8D8C4]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#2C1819]">{team.leader.name}</span>
                      </div>
                      <span className="text-[11px] text-[#6B5B52]">{team.leader.title || 'Team Leader'}</span>
                    </div>
                  </div>
                  <span className="badge badge-in_progress text-[10px]">Team Leader</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#FFF8EB] border border-[#F7E3BD] text-xs text-[#A36A00] mb-4">
                  No leader currently assigned.
                </div>
              )}

              {/* Members List Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#2C1819] uppercase tracking-wider block mb-1">
                  Members ({team.membersCount})
                </span>

                <div className="divide-y divide-[#F0E6D8] max-h-48 overflow-y-auto pr-1">
                  {team.members.map(member => (
                    <div key={member.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={member.name}
                          className="w-7 h-7 rounded-full object-cover border border-[#E8D8C4]"
                        />
                        <div>
                          <span className="font-semibold text-[#2C1819] block">{member.name}</span>
                          <span className="text-[11px] text-[#6B5B52]">{member.title || member.role}</span>
                        </div>
                      </div>

                      {user?.role === 'MANAGER' && (
                        <select
                          value={member.teamId || ''}
                          onChange={(e) => handleReassignUserTeam(member.id, e.target.value)}
                          className="input-field py-0.5 px-2 text-[11px] w-auto rounded-lg"
                        >
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Metrics Footer */}
            <div className="pt-3 border-t border-[#F0E6D8] flex items-center justify-between text-xs text-[#6B5B52]">
              <span>Total Tasks: <strong className="text-[#2C1819] font-mono font-bold">{team.totalTasks}</strong></span>
              <span>Active Tasks: <strong className="text-[#561C24] font-mono font-bold">{team.activeTasks}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <TeamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdateTeam}
        initialData={editingTeam}
        users={allUsers}
      />
    </div>
  );
};

export default TeamsPage;
