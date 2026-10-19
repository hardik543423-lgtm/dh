import React, { useState, useEffect } from 'react';
import { Landmark, Clock, CheckCircle2, XCircle, History } from 'lucide-react';
import { formatCurrency } from '../FundHelpers';

export default function TransactionHistory({ brokerId, customerId, token, apiBase }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!brokerId || !customerId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/transactions/history?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setHistory(result.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [brokerId, customerId]);

  if (loading) return null; // Or a small skeleton

  return (
    <div className="space-y-4 animate-up" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[var(--text-secondary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</h3>
        </div>
        <button onClick={fetchHistory} className="text-[11px] font-bold text-blue-500 hover:underline">Refresh</button>
      </div>

      <div className="space-y-3">
        {history.length > 0 ? history.map((item) => (
          <div key={item._id} className="large-card !py-4 !px-5 flex items-center justify-between group hover:border-blue-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${item.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                <Landmark size={18} />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[var(--text-primary)] capitalize">{item.type} {item.status}</h4>
                <p className="text-[10px] text-[var(--text-secondary)] opacity-60 font-medium">
                  {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${item.type === 'deposit' ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                {item.type === 'deposit' ? '+' : '-'}{formatCurrency(item.amount)}
              </p>
              <div className="flex items-center justify-end gap-1 mt-1">
                {item.status === 'pending' ? <Clock size={10} className="text-amber-500" /> : item.status === 'verified' ? <CheckCircle2 size={10} className="text-emerald-500" /> : <XCircle size={10} className="text-red-500" />}
                <span className={`text-[9px] font-bold uppercase tracking-tight ${item.status === 'pending' ? 'text-amber-500' : item.status === 'verified' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-10 bg-[var(--bg-secondary)] rounded-2xl border border-dashed border-[var(--border-color)]">
            <History size={32} className="mx-auto text-[var(--text-secondary)] opacity-20 mb-2" />
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-40">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
