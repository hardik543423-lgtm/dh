import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, TrendingUp, Zap, Pencil, Check, X, ChevronLeft, Wallet, Unlock, Lock, ShieldCheck, PieChart } from 'lucide-react';
import { formatCurrency } from './FundHelpers';
import "./Funds.css";

import { usePermissions } from "../../contexts/PermissionsContext";

export default function McxFundView() {
  const navigate = useNavigate();
  const { refreshPermissions } = usePermissions();
  
  const [fundsData, setFundsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Identity logic
  const userString = localStorage.getItem('loggedInUser');
  let userObject = {};
  try { userObject = userString ? JSON.parse(userString) : {}; } catch(e){}
  if (!userObject) userObject = {};
  const userRole = userObject?.role;

  const activeContextString = localStorage.getItem('activeContext');
  let activeContext = {};
  try { activeContext = activeContextString ? JSON.parse(activeContextString) : {}; } catch(e){}
  if (!activeContext) activeContext = {};

  const isBroker = userRole === 'broker';
  const brokerId = isBroker ? (userObject?.id || userObject?._id) : (userObject?.brokerId || activeContext?.brokerId);
  const customerId = isBroker ? (activeContext?.customerId || activeContext?.id) : (userObject?.id || userObject?._id);

  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  useEffect(() => {
    refreshPermissions();
  }, []);

  const fetchFunds = async () => {
    if (!brokerId || !customerId) {
      console.warn("[MCX Funds] Missing IDs, skipping fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const result = await res.json();
      if (result.success && result.data) {
        setFundsData(result.data);
      }
    } catch (error) {
      console.error('[MCX Funds] Fetch Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brokerId && customerId) fetchFunds();
    else setLoading(false);
  }, [brokerId, customerId]);

  // Handler functions for editing Net MCX Balance (Card 1) and MCX Deposit (Card 2)
  const handleUpdateMcxAvailable = async (newLimit) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxAvailableLimit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_limit: newLimit })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxDeposit = async (newDeposit) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxDeposit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_deposit: newDeposit })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxLimitsAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxOptionPercentage = async (newPercent) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxOptionLimitPercentage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, percentage: newPercent })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxOptionLimitsAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxOptionLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  // States for Summary Card Editing
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  
  const [tempBalance, setTempBalance] = useState(0);
  const [tempDeposit, setTempDeposit] = useState(0);

  // States for detailed limits editing
  const [editingField, setEditingField] = useState(null); // 'mcx', 'option'
  const [tempAvailable, setTempAvailable] = useState('');
  const [tempFree, setTempFree] = useState('');
  const [tempUsed, setTempUsed] = useState('');
  const [tempPercentage, setTempPercentage] = useState('');

  const firstInputRef = useRef(null);
  const prevEditingField = useRef(null);

  useEffect(() => {
    if (editingField && editingField !== prevEditingField.current && firstInputRef.current) {
      firstInputRef.current.focus();
    }
    prevEditingField.current = editingField;
  }, [editingField]);

  const startEdit = (field, currentAvailable, currentFree, currentUsed, currentPercentage) => {
    setEditingField(field);
    setTempAvailable(String(currentAvailable));
    setTempFree(String(currentFree));
    setTempUsed(String(currentUsed));
    setTempPercentage(String(currentPercentage));
  };

  const handleSaveDetails = () => {
    if (editingField === 'mcx') {
        handleUpdateMcxLimitsAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
    } else if (editingField === 'option') {
        handleUpdateMcxOptionLimitsAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
        if (Number(tempPercentage) !== (fundsData?.mcx_option_limit_percentage || 10)) {
          handleUpdateMcxOptionPercentage(Number(tempPercentage));
        }
    }
    setEditingField(null);
  };

  const SkeletonLoader = () => (
    <div className="funds-container">
      <div className="section-header px-1">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" style={{ width: '80%' }} />
      </div>
      <div className="skeleton skeleton-card" style={{ height: '140px' }} />
      <div className="skeleton skeleton-card" style={{ height: '120px' }} />
      <div className="skeleton skeleton-card" style={{ height: '300px' }} />
    </div>
  );

  if (loading) return <SkeletonLoader />;

  const mcxAvailable = fundsData?.mcx_limit?.available_limit || 0;
  const mcxUsed = (fundsData?.mcx_limit?.intraday?.used_today || 0) + (fundsData?.mcx_limit?.overnight?.used_today || 0);
  const mcxFree = fundsData?.mcx_limit?.free_limit !== undefined ? fundsData?.mcx_limit?.free_limit : Math.max(0, mcxAvailable - mcxUsed);

  const optionTotal = (mcxAvailable * (fundsData?.mcx_option_limit_percentage || 10)) / 100;
  const optionUsed = (fundsData?.mcx_option_limit?.intraday?.used_today || 0) + (fundsData?.mcx_option_limit?.overnight?.used_today || 0);
  const finalOptionAvailable = fundsData?.mcx_option_limit?.available_limit !== undefined ? fundsData?.mcx_option_limit?.available_limit : optionTotal;
  const finalOptionUsed = fundsData?.mcx_option_limit?.used_limit !== undefined ? fundsData?.mcx_option_limit?.used_limit : optionUsed;
  const finalOptionFree = fundsData?.mcx_option_limit?.free_limit !== undefined ? fundsData?.mcx_option_limit?.free_limit : Math.max(0, finalOptionAvailable - finalOptionUsed);

  const renderMarginSection = (title, available, used, free, accentColor, Icon, fieldKey) => (
    <div key={fieldKey} className="margin-section-group p-4 bg-[var(--bg-primary)]/50 rounded-2xl border border-[var(--border-color)]/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${accentColor} bg-opacity-10`}>
            <Icon size={16} className={accentColor.replace('bg-', 'text-')} />
          </div>
          <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h4>
        </div>
        {isBroker && editingField !== fieldKey && (
          <button 
            onClick={() => startEdit(fieldKey, available, free, used, fieldKey === 'option' ? (fundsData?.mcx_option_limit_percentage || 10) : 0)}
            className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-blue-500/5 rounded-lg transition-all"
          >
            <Pencil size={12} />
          </button>
        )}
        {isBroker && editingField === fieldKey && (
          <div className="flex items-center gap-1">
            <button onClick={handleSaveDetails} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><Check size={14} /></button>
            <button onClick={() => setEditingField(null)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"><X size={14} /></button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Available Limit */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Wallet size={12} className="opacity-60" />
            <span className="text-[11px] font-medium">Available Limit</span>
          </div>
          {editingField === fieldKey ? (
            <input 
              ref={fieldKey === editingField ? firstInputRef : null}
              type="number" 
              value={tempAvailable}
              onChange={(e) => {
                const val = e.target.value;
                setTempAvailable(val);
                const numVal = Number(val);
                const numUsed = Number(tempUsed) || 0;
                setTempFree(String(Math.max(0, numVal - numUsed)));
              }}
              className="bg-transparent border-b border-blue-500 text-[12px] font-bold outline-none text-[var(--text-primary)] w-24 text-right"
            />
          ) : (
            <span className="text-[12px] font-bold text-[var(--text-primary)]">{formatCurrency(available)}</span>
          )}
        </div>

        {/* Free Limit */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-400">
            <Unlock size={12} className="opacity-80" />
            <span className="text-[11px] font-bold">Free Limit (Unused)</span>
          </div>
          {editingField === fieldKey ? (
            <input 
              type="number" 
              value={tempFree}
              onChange={(e) => {
                const val = e.target.value;
                setTempFree(val);
                const numVal = Number(val);
                const numAvail = Number(tempAvailable) || 0;
                setTempUsed(String(Math.max(0, numAvail - numVal)));
              }}
              className="bg-transparent border-b border-indigo-500 text-[12px] font-bold outline-none text-indigo-400 w-24 text-right"
            />
          ) : (
            <span className="text-[12px] font-black text-indigo-400">{formatCurrency(free)}</span>
          )}
        </div>

        {/* Used Limit */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-400">
            <Lock size={12} className="opacity-60" />
            <span className="text-[11px] font-medium">Used Limit (Blocked)</span>
          </div>
          {editingField === fieldKey ? (
            <input 
              type="number" 
              value={tempUsed}
              onChange={(e) => {
                const val = e.target.value;
                setTempUsed(val);
                const numVal = Number(val);
                const numAvail = Number(tempAvailable) || 0;
                setTempFree(String(Math.max(0, numAvail - numVal)));
              }}
              className="bg-transparent border-b border-red-500 text-[12px] font-bold outline-none text-red-400 w-24 text-right"
            />
          ) : (
            <span className="text-[12px] font-bold text-red-400">{formatCurrency(used)}</span>
          )}
        </div>

        {fieldKey === 'option' && editingField === fieldKey && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-color)]/20">
             <div className="flex items-center gap-2 text-amber-500">
               <PieChart size={12} className="opacity-80" />
               <span className="text-[11px] font-bold">MCX Option Percentage (%)</span>
             </div>
             <input 
                type="number" 
                value={tempPercentage}
                onChange={(e) => {
                  const val = e.target.value;
                  setTempPercentage(val);
                  const pct = Number(val) || 0;
                  const dynamicAvailable = mcxAvailable * (pct / 100);
                  setTempAvailable(String(dynamicAvailable));
                  
                  const numUsed = Number(tempUsed) || 0;
                  setTempFree(String(Math.max(0, dynamicAvailable - numUsed)));
                }}
                className="bg-transparent border-b border-amber-500 text-[12px] font-bold outline-none text-amber-500 w-24 text-right"
              />
          </div>
        )}
      </div>

      <div className="mt-4 h-1 w-full bg-[var(--border-color)]/20 rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-1000 bg-blue-500" 
          style={{ width: available > 0 ? `${(used/available)*100}%` : '0%' }}
        />
      </div>
    </div>
  );

  return (
    <div className="funds-container">
      <div className="funds-content-wrapper">
        
        {/* Header */}
        <div className="section-header px-1 animate-up">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/funds')} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
            </button>
            <h1>MCX Funds</h1>
          </div>
          
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {customerId && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] px-4 py-1.5 rounded-2xl shadow-sm flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-secondary)] font-extrabold uppercase tracking-widest opacity-60">ID</span>
                <span className="text-xs font-bold text-[var(--text-primary)]">{customerId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="space-y-4 animate-up" style={{ animationDelay: '0.2s' }}>
          
          {/* Card 1: Net MCX Balance */}
          <div className="large-card dark-card relative overflow-hidden min-h-[140px] flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
              <Landmark size={84} className="text-white" />
            </div>
            
            <div>
              <span className="stat-label text-white/80">Net MCX Balance</span>
              {isEditingBalance ? (
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="number" 
                    value={tempBalance}
                    onChange={(e) => setTempBalance(e.target.value)}
                    className="bg-transparent border-b-2 border-white/50 text-3xl font-black outline-none text-white w-full"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        handleUpdateMcxAvailable(Number(tempBalance));
                        setIsEditingBalance(false);
                      }} 
                      className="p-2 bg-white/20 text-white rounded-xl hover:bg-white/30"
                    >
                      <Check size={18} />
                    </button>
                    <button onClick={() => setIsEditingBalance(false)} className="p-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20"><X size={18} /></button>
                  </div>
                </div>
              ) : (
                <h2 className="stat-value text-white text-4xl mt-1">{formatCurrency(mcxAvailable)}</h2>
              )}
            </div>

            <div className="flex items-end justify-between mt-4">
              <div className="flex-1">
                 {isBroker && !isEditingBalance && (
                  <button 
                    onClick={() => { setTempBalance(mcxAvailable); setIsEditingBalance(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 border-b border-b-white/10"
                  >
                    <Pencil size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Edit Balance</span>
                  </button>
                )}
              </div>
              <span className="sub-label text-white/60 text-right">MCX Trading Power</span>
            </div>
          </div>

          {/* Card 2: MCX Deposit */}
          <div className="large-card !py-5 !px-6 bg-[var(--bg-secondary)] flex flex-col justify-between min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="stat-label !mb-0">MCX Deposit</span>
              <div className="p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]/50">
                <Landmark size={18} className="text-[var(--text-muted)]" />
              </div>
            </div>
            
            {isEditingDeposit ? (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="number" 
                  value={tempDeposit}
                  onChange={(e) => setTempDeposit(e.target.value)}
                  className="bg-transparent border-b-2 border-blue-500 text-2xl font-bold outline-none text-[var(--text-primary)] w-full"
                  autoFocus
                />
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      handleUpdateMcxDeposit(Number(tempDeposit));
                      setIsEditingDeposit(false);
                    }} 
                    className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg"
                  >
                    <Check size={18} />
                  </button>
                  <button onClick={() => setIsEditingDeposit(false)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><X size={18} /></button>
                </div>
              </div>
            ) : (
              <h2 className="stat-value !text-2xl mt-2">{formatCurrency(fundsData?.mcx_deposit || 0)}</h2>
            )}

            <div className="mt-4">
              {isBroker && !isEditingDeposit && (
                <button 
                  onClick={() => { setTempDeposit(fundsData?.mcx_deposit || 0); setIsEditingDeposit(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-muted)] hover:text-blue-500 bg-[var(--bg-primary)] hover:bg-blue-500/5 rounded-lg border border-[var(--border-color)] transition-all"
                >
                  <Pencil size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="mt-6">
          <div className="details-container-card animate-up" style={{ animationDelay: '0.3s' }}>
            <div className="details-header-row mb-6">
              <ShieldCheck className="text-blue-500" size={20} />
              <span className="font-black tracking-tight text-[15px]">MCX Trading Margin Details</span>
            </div>

            <div className="space-y-4">
              {renderMarginSection(
                "MCX Trading Margin",
                mcxAvailable,
                mcxUsed,
                mcxFree,
                "bg-blue-500",
                Zap,
                "mcx"
              )}

              {renderMarginSection(
                `MCX Option Limit (${fundsData?.mcx_option_limit_percentage || 10}%)`,
                finalOptionAvailable,
                finalOptionUsed,
                finalOptionFree,
                "bg-amber-500",
                PieChart,
                "option"
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
