import React, { useState, useEffect } from 'react';
import { ArrowDownCircle, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function WithdrawalLimitsCard({ minLimit, maxLimit, onSave }) {
  const [tempMin, setTempMin] = useState(minLimit);
  const [tempMax, setTempMax] = useState(maxLimit);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg }

  useEffect(() => {
    setTempMin(minLimit);
    setTempMax(maxLimit);
  }, [minLimit, maxLimit]);

  const handleSave = async () => {
    const min = Number(tempMin) || 0;
    const max = Number(tempMax) || 0;

    if (min > 0 && max > 0 && min > max) {
      setStatus({ type: 'error', msg: 'Min limit cannot be greater than Max limit' });
      return;
    }

    setStatus(null);
    setSaving(true);
    try {
      await onSave(min, max);
      setStatus({ type: 'success', msg: 'Limits saved successfully' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Failed to update limits' });
    } finally {
      setSaving(false);
    }
  };

  // Check if values changed from saved values
  const hasChanges = Number(tempMin) !== minLimit || Number(tempMax) !== maxLimit;

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm animate-up" style={{ animationDelay: '0.15s' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
          <ArrowDownCircle size={18} style={{ color: '#f97316' }} />
        </div>
        <span className="font-extrabold tracking-tight text-[14px] text-[var(--text-primary)]">Withdrawal Limits</span>
      </div>

      {/* Status Message */}
      {status && (
        <div 
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-[11px] font-bold ${
            status.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-500' 
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {status.msg}
        </div>
      )}

      {/* Min Input */}
      <div className="mb-4">
        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5 block">
          Minimum Withdrawal
        </label>
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3">
          <span className="text-base font-bold text-[var(--text-muted)]">₹</span>
          <input
            type="number"
            value={tempMin}
            onChange={(e) => { setTempMin(e.target.value); setStatus(null); }}
            placeholder="0"
            min="0"
            className="w-full bg-transparent text-base font-bold outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        <p className="text-[9px] text-[var(--text-muted)] mt-1 px-1 font-medium">0 = No minimum limit</p>
      </div>

      {/* Max Input */}
      <div className="mb-5">
        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1.5 block">
          Maximum Withdrawal
        </label>
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3">
          <span className="text-base font-bold text-[var(--text-muted)]">₹</span>
          <input
            type="number"
            value={tempMax}
            onChange={(e) => { setTempMax(e.target.value); setStatus(null); }}
            placeholder="0"
            min="0"
            className="w-full bg-transparent text-base font-bold outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        <p className="text-[9px] text-[var(--text-muted)] mt-1 px-1 font-medium">0 = No maximum limit</p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all active:scale-[0.97] ${
          hasChanges 
            ? 'bg-orange-500 text-white shadow-lg hover:bg-orange-600' 
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-color)]'
        }`}
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Save size={16} />
            {hasChanges ? 'Save Limits' : 'No Changes'}
          </>
        )}
      </button>

      {/* Info */}
      <p className="text-[9px] text-[var(--text-muted)] font-medium mt-3 text-center">
        Only visible to you (broker). Customer cannot see these limits.
      </p>
    </div>
  );
}
