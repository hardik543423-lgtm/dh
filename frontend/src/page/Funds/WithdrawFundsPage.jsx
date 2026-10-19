import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Landmark, Send, Phone, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { formatCurrency } from './FundHelpers';
import WithdrawalLimitsCard from './components/WithdrawalLimitsCard';

export default function WithdrawFundsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fundsData, setFundsData] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', msg }

  // Context
  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const isBroker = userObject.role === 'broker';

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  
  const brokerId = isBroker ? activeContext.brokerId : (userObject.brokerId || activeContext.brokerId);
  const customerId = isBroker ? activeContext.customerId : (userObject.id || activeContext.customerId);

  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const fetchData = async () => {
    if (!brokerId || !customerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fundRes = await fetch(`${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fundResult = await fundRes.json();
      if (fundResult.success) setFundsData(fundResult.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [brokerId, customerId]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleWithdrawRequest = async () => {
    if (!amount || Number(amount) <= 0) return;
    if (Number(amount) > (fundsData?.net_available_balance || 0)) {
      showToast('error', 'Insufficient balance for this withdrawal.');
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch(`${apiBase}/api/transactions/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          broker_id_str: brokerId,
          customer_id_str: customerId,
          type: 'withdraw',
          amount: Number(amount),
          reason: reason,
          bank_details: fundsData?.payment_details
        })
      });
      const result = await res.json();
      if (result.success) {
        setAmount('');
        setReason('');
        showToast('success', 'Withdrawal request submitted successfully!');
        setTimeout(() => navigate('/funds'), 1500);
      } else {
        showToast('error', result.message || 'Request Failed');
      }
    } catch (error) {
      console.error(error);
      showToast('error', 'System Error: Could not send request.');
    } finally {
      setRequesting(false);
    }
  };

  const SkeletonLoader = () => (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="skeleton skeleton-badge" style={{ width: '40px', height: '40px' }} />
        <div className="skeleton skeleton-title" style={{ width: '150px' }} />
      </div>
      <div className="skeleton skeleton-card" style={{ height: '120px' }} />
      <div className="skeleton skeleton-card" style={{ height: '300px' }} />
      <div className="skeleton skeleton-card" style={{ height: '200px' }} />
    </div>
  );

  if (loading) return <SkeletonLoader />;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-20 font-sans">
      {/* Header */}
      <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/funds')} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Withdraw Funds</h1>
        </div>
      </div>

      {/* Toast Message */}
      {toast && (
        <div className={`mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-[13px] animate-up ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-1 hover:opacity-70 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
        {/* Balance Card */}
        <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm animate-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Withdrawable Cash</span>
            <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">Settled</div>
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)]">{formatCurrency(fundsData?.net_available_balance || 0)}</h2>
          <p className="text-[10px] text-[var(--text-muted)] mt-2 font-medium">Funds typically arrive in your bank in 1-2 business days.</p>
        </div>

        {/* Withdrawal Limits - Broker Only */}
        {isBroker && (
          <WithdrawalLimitsCard 
            minLimit={fundsData?.withdrawal_limits?.min || 0}
            maxLimit={fundsData?.withdrawal_limits?.max || 0}
            onSave={async (min, max) => {
              try {
                await fetch(`${apiBase}/api/funds/updateWithdrawalLimits`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, min, max })
                });
                await fetchData();
              } catch (err) { console.error(err); }
            }}
          />
        )}

        {/* Withdraw Form */}
        <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm space-y-5 animate-up" style={{ animationDelay: '0.1s' }}>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2 block">Amount to Withdraw</label>
            <div className="flex items-center gap-2 pb-2 border-b-2 border-[var(--border-light)] focus-within:border-blue-500 transition-colors">
              <span className="text-2xl font-bold text-[var(--text-muted)]">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-2xl font-bold outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <button 
                onClick={() => setAmount(fundsData?.net_available_balance || 0)}
                className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2 block">Primary Bank Account</label>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl p-4 flex items-center gap-4">
              <div className="bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)]">
                <Landmark size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{fundsData?.payment_details?.bank_name || 'No Bank Linked'}</p>
                <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-wider">A/C: {fundsData?.payment_details?.account_number || '****'}</p>
              </div>
              <div className="text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-1 rounded">Pre-filled</div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2 block">Reason (Optional)</label>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Personal expenses"
              rows={2}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] text-[var(--text-primary)] transition-all resize-none"
            />
          </div>

          <button 
            onClick={handleWithdrawRequest}
            disabled={!amount || requesting}
            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all ${
              !amount ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95'
            }`}
          >
            {requesting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send size={18} /> Request Withdrawal</>}
          </button>
        </div>
      </div>
    </div>
  );
}
