import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Save, Loader2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AdvanceJobbingView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ranges, setRanges] = useState([]);
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

    const fetchAdvancedJobbing = async () => {
      try {
        const res = await fetch(`${apiBase}/api/advanced-jobbing?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          setRanges(result.ranges || []);
        }
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdvancedJobbing();
  }, [customerId, brokerId, token, apiBase]);

  const handleAddRow = () => {
    setRanges(prev => [
      ...prev,
      { start_range: '', end_range: '', jobbing_value: '', jobbing_type: 'percentage' }
    ]);
    setStatus({ type: null, message: null });
  };

  const handleRemoveRow = (index) => {
    setRanges(prev => prev.filter((_, idx) => idx !== index));
    setStatus({ type: null, message: null });
  };

  const handleFieldChange = (index, field, value) => {
    setRanges(prev => prev.map((row, idx) => {
      if (idx === index) {
        return { ...row, [field]: value };
      }
      return row;
    }));
    setStatus({ type: null, message: null });
  };

  const handleSave = async () => {
    if (!brokerId || !customerId) {
        setStatus({ type: 'error', message: 'Missing Broker or Customer ID' });
        return;
    }

    // Validation
    const validatedRanges = [];
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const start = parseFloat(r.start_range);
      const end = parseFloat(r.end_range);
      const val = parseFloat(r.jobbing_value);

      if (isNaN(start) || isNaN(end) || isNaN(val)) {
        setStatus({ type: 'error', message: `Row ${i + 1} contains invalid numeric inputs.` });
        return;
      }

      if (start < 0 || end < 0 || val < 0) {
        setStatus({ type: 'error', message: `Row ${i + 1} values cannot be negative.` });
        return;
      }

      if (start > end) {
        setStatus({ type: 'error', message: `Row ${i + 1}: Start Range must be less than or equal to End Range.` });
        return;
      }

      validatedRanges.push({
        start_range: start,
        end_range: end,
        jobbing_value: val,
        jobbing_type: r.jobbing_type || 'percentage'
      });
    }

    setSaving(true);
    setStatus({ type: null, message: null });

    try {
      const res = await fetch(`${apiBase}/api/advanced-jobbing/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          broker_id_str: String(brokerId),
          customer_id_str: String(customerId),
          ranges: validatedRanges
        })
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
        setStatus({ type: 'success', message: 'Advanced Jobbing ranges updated successfully!' });
        
        // Update local ranges with parsed/saved list
        setRanges(result.ranges || []);

        // Brief delay before navigating back
        setTimeout(() => {
            navigate(-1);
        }, 1500);
      } else {
        throw new Error(result.message || "Failed to save settings");
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (userObject.role !== 'broker') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Access Denied</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Only brokers can access this page.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Loading Settings...</p>
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
          <h1 className="text-lg font-bold">Advance Jobbing</h1>
          <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Customer ID: {customerId}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6 animate-up">
        
        {status.message && (
            <div className={`flex items-center gap-3 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-300 ${
                status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-xs font-bold">{status.message}</p>
            </div>
        )}

        {/* Info Card */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-indigo-600">Range-Based Custom Jobbing</h3>
            <p className="text-xs text-[var(--text-secondary)] opacity-80 leading-relaxed">
              Define target LTP price ranges and assign specific jobbing rates. If the LTP of a stock falls outside these ranges, the fallback watchlist jobbing (configured on the watchlist page) will automatically apply.
            </p>
          </div>
        </div>

        {/* Ranges Form List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-widest">Jobbing Ranges</h3>
            <button 
              onClick={handleAddRow}
              className="flex items-center gap-1 text-xs text-indigo-500 font-bold hover:text-indigo-400"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div className="space-y-3">
            {ranges.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                No ranges defined. Falling back completely to default watchlist jobbing.
              </div>
            ) : (
              ranges.map((row, index) => (
                <div key={index} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm relative space-y-3 flex flex-col">
                  
                  {/* Row Header with Delete button */}
                  <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2 mb-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Range #{index + 1}</span>
                    <button 
                      onClick={() => handleRemoveRow(index)}
                      className="p-1 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                      title="Delete Range"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Range Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase">Start LTP (₹)</label>
                      <input 
                        type="number" 
                        value={row.start_range}
                        onChange={(e) => handleFieldChange(index, 'start_range', e.target.value)}
                        placeholder="0"
                        className="bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase">End LTP (₹)</label>
                      <input 
                        type="number" 
                        value={row.end_range}
                        onChange={(e) => handleFieldChange(index, 'end_range', e.target.value)}
                        placeholder="500"
                        className="bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Jobbing value & type */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase">Jobbing Value</label>
                      <input 
                        type="number" 
                        step="any"
                        value={row.jobbing_value}
                        onChange={(e) => handleFieldChange(index, 'jobbing_value', e.target.value)}
                        placeholder="0.08"
                        className="bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase">Jobbing Type</label>
                      <select 
                        value={row.jobbing_type}
                        onChange={(e) => handleFieldChange(index, 'jobbing_type', e.target.value)}
                        className="bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="points">Points (₹)</option>
                      </select>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold text-sm text-white shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save size={18} /> Save Settings</>}
        </button>

      </div>
    </div>
  );
}
