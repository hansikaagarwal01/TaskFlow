import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Sparkles, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export const AIInsightsWidget = ({ onRebalanceExecuted }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const { addToast } = useNotifications();

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const data = await api.get('/ai/insights');
      setInsights(data);
    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleApplyRebalance = async (rec) => {
    if (!rec.taskId || !rec.suggestedUser) return;
    setExecuting(true);
    try {
      await api.post('/ai/rebalance', {
        taskId: rec.taskId,
        newAssigneeId: rec.suggestedUser
      });
      addToast('Workload rebalance applied successfully.', 'success');
      fetchInsights();
      if (onRebalanceExecuted) onRebalanceExecuted();
    } catch (err) {
      addToast(err.message || 'Failed to apply rebalance.', 'error');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-beige p-6 text-center text-xs text-[#6B5B52] rounded-2xl">
        Calculating workload analytics & forecasting risk metrics...
      </div>
    );
  }

  if (!insights) return null;

  const { executiveSummary, recommendations } = insights;

  return (
    <div className="card-beige p-6 space-y-5 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#F0E6D8]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#561C24] flex items-center justify-center text-[#FAF6F0] shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#2C1819]">
              Workload & Risk Intelligence
            </h3>
            <p className="text-[11px] text-[#6B5B52]">Automated bottleneck detection and workload optimization</p>
          </div>
        </div>

        <button
          onClick={fetchInsights}
          className="p-2 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4] text-[#6B5B52] hover:text-[#561C24] hover:bg-[#F5EFE6] transition-colors"
          title="Refresh Analysis"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#F5EFE6] p-3.5 rounded-xl border border-[#E8D8C4]">
          <span className="text-[10px] font-bold text-[#6B5B52] uppercase block mb-0.5">Health Index</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold font-mono text-[#2C1819]">
              {executiveSummary.healthScore}/100
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#F0F7F2] text-[#2D6A4F] border border-[#C8E6C9] font-bold">GOOD</span>
          </div>
        </div>

        <div className="bg-[#F5EFE6] p-3.5 rounded-xl border border-[#E8D8C4]">
          <span className="text-[10px] font-bold text-[#6B5B52] uppercase block mb-0.5">High Risk Tasks</span>
          <span className="text-base font-extrabold font-mono text-[#9B2C2C]">{executiveSummary.highRiskTasksCount}</span>
        </div>

        <div className="bg-[#F5EFE6] p-3.5 rounded-xl border border-[#E8D8C4]">
          <span className="text-[10px] font-bold text-[#6B5B52] uppercase block mb-0.5">Pending Approvals</span>
          <span className="text-base font-extrabold font-mono text-[#A36A00]">{executiveSummary.pendingApprovals}</span>
        </div>

        <div className="bg-[#F5EFE6] p-3.5 rounded-xl border border-[#E8D8C4]">
          <span className="text-[10px] font-bold text-[#6B5B52] uppercase block mb-0.5">Completion Velocity</span>
          <span className="text-base font-extrabold font-mono text-[#561C24]">{executiveSummary.completedTasks}/{executiveSummary.totalTasks}</span>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-[#2C1819] block">AI Recommendations</span>
          {recommendations.map((rec, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E8D8C4] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#A36A00] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#2C1819] block">{rec.title}</span>
                  <p className="text-[#6B5B52] text-[11px] mt-0.5">{rec.message}</p>
                </div>
              </div>

              {rec.type === 'WORKLOAD_REBALANCE' && rec.suggestedUser && (
                <button
                  onClick={() => handleApplyRebalance(rec)}
                  disabled={executing}
                  className="btn-primary text-[11px] py-1.5 px-3 shrink-0 rounded-lg self-end md:self-auto"
                >
                  <span>{executing ? 'Applying...' : 'Apply Rebalance'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#C8E6C9] text-xs text-[#2D6A4F] flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
          <span>No critical workload bottlenecks detected. Organization operating normally.</span>
        </div>
      )}
    </div>
  );
};

export default AIInsightsWidget;
