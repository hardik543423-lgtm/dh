import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Shield, Lock, Unlock, Save, Loader2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { id: 'buy', label: 'Buy (Market/Limit)', description: 'Restrict customer from placing buy orders' },
  { id: 'sell', label: 'Sell (Market/Limit)', description: 'Restrict customer from placing sell orders' },
  { id: 'add_funds', label: 'Add Funds', description: 'Lock the fund deposit request button' },
  { id: 'withdraw_funds', label: 'Withdraw Funds', description: 'Lock the fund withdrawal request button' },
  { id: 'modify_order', label: 'Modify Orders', description: 'Restrict editing open orders' },
  { id: 'cancel_order', label: 'Cancel Orders', description: 'Restrict canceling open orders' },
  { id: 'hide_order_dates', label: 'Hide Order Dates', description: 'Hide order date in open orders and closed date in closed orders' },
];

export default function CustomerPermissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState({});
  const [status, setStatus] = useState({ type: null, message: null });

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const brokerId = activeContext.brokerId || (userObject.role === 'broker' ? (userObject.id || userObject._id) : null);
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  useEffect(() => {
    if (!customerId || !brokerId) {
        setLoading(false);
        return;
    }

    const fetchPermissions = async () => {
      try {
        const res = await fetch(`${apiBase}/api/permissions/get?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          setLockedFeatures(result.data.locked_features || {});
        }
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [customerId, brokerId, token, apiBase]);

  const handleToggle = (id) => {
    setLockedFeatures(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    setStatus({ type: null, message: null });
  };

  const handleSave = async () => {
    if (!brokerId || !customerId) {
        setStatus({ type: 'error', message: 'Missing Broker or Customer ID' });
        return;
    }

    setSaving(true);
    setStatus({ type: null, message: null });

    try {
      const res = await fetch(`${apiBase}/api/permissions/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          broker_id_str: String(brokerId),
          customer_id_str: String(customerId),
          locked_features: lockedFeatures
        })
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
        setStatus({ type: 'success', message: 'Permissions updated successfully!' });
        window.dispatchEvent(new CustomEvent('permissions:updated'));
        
        // Brief delay before navigating back
        setTimeout(() => {
            navigate(-1);
        }, 1500);
      } else {
        throw new Error(result.message || "Failed to save permissions");
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: error.message || 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Loading Permissions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-color)] px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Feature Controls</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Customer ID: {customerId}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        
        {status.message && (
            <div className={`flex items-center gap-3 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-300 ${
                status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-xs font-bold">{status.message}</p>
            </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-blue-600">Broker Privilege</h3>
            <p className="text-xs text-blue-500/80 leading-relaxed">
              Enable the "Lock" to restrict this customer from using specific features. Locked buttons will remain visible but non-functional with a lock icon.
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-widest px-1">Manage Restrictions</h3>
          
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
            {FEATURES.map((feature, idx) => {
              const isLocked = lockedFeatures[feature.id];
              return (
                <div 
                  key={feature.id} 
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${idx !== FEATURES.length - 1 ? 'border-b border-[var(--border-color)]' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLocked ? 'bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-[var(--bg-primary)] border border-[var(--border-color)]'}`}>
                    {isLocked ? <Lock size={18} className="text-red-500" /> : <Unlock size={18} className="text-emerald-500 opacity-60" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold ${isLocked ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{feature.label}</h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">{feature.description}</p>
                  </div>

                  <button 
                    onClick={() => handleToggle(feature.id)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 shadow-inner ${isLocked ? 'bg-red-500' : 'bg-[var(--bg-primary)] border border-[var(--border-color)]'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 flex items-center justify-center ${isLocked ? 'translate-x-6' : 'translate-x-0'}`}>
                      {isLocked ? <Lock size={10} className="text-red-500" /> : <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold text-sm text-white shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save size={18} /> Save Restrictions</>}
        </button>

      </div>
    </div>
  );
}
