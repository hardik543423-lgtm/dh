import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../FundHelpers';
import { ShieldCheck, Wallet, Lock, Zap, Pencil, Check, X, Activity, Briefcase, PieChart, Unlock } from 'lucide-react';

export default function FundsDetails({ 
  intradayMargin, 
  intradayUsed,
  intradayFreeLimit,
  deliveryMargin, 
  deliveryUsed,
  deliveryFreeLimit,
  optionUsed,
  optionTotal,
  optionAvailableLimit,
  optionFreeLimit,
  optionUsedLimit,
  optionPercentage,
  mcxUsed,
  mcxTotal,
  mcxAvailableLimit,
  mcxFreeLimit,
  mcxUsedLimit,
  mcxPercentage,
  realizedPnl,
  isBroker,
  onUpdateIntradayAll,
  onUpdateOvernightAll,
  onUpdateOptionAll,
  onUpdateOptionPercentage,
  onUpdateMcxAll,
  onUpdateMcxPercentage
}) {
  // Calculations for display
  const intradayFree = intradayFreeLimit !== undefined ? intradayFreeLimit : Math.max(0, intradayMargin - intradayUsed);
  const deliveryFree = deliveryFreeLimit !== undefined ? deliveryFreeLimit : Math.max(0, deliveryMargin - deliveryUsed);
  
  const finalOptionAvailable = optionAvailableLimit !== undefined ? optionAvailableLimit : optionTotal;
  const finalOptionUsed = optionUsedLimit !== undefined ? optionUsedLimit : optionUsed;
  const finalOptionFree = optionFreeLimit !== undefined ? optionFreeLimit : Math.max(0, finalOptionAvailable - finalOptionUsed);

  const finalMcxAvailable = mcxAvailableLimit !== undefined ? mcxAvailableLimit : mcxTotal;
  const finalMcxUsed = mcxUsedLimit !== undefined ? mcxUsedLimit : mcxUsed;
  const finalMcxFree = mcxFreeLimit !== undefined ? mcxFreeLimit : Math.max(0, finalMcxAvailable - finalMcxUsed);

  // States for editing limits
  const [editingField, setEditingField] = useState(null); // 'intraday', 'overnight', 'option', 'mcx'
  const [tempAvailable, setTempAvailable] = useState('');
  const [tempFree, setTempFree] = useState('');
  const [tempUsed, setTempUsed] = useState('');
  const [tempPercentage, setTempPercentage] = useState('');

  // Ref to focus the first input only once when edit mode starts
  const firstInputRef = useRef(null);
  const prevEditingField = useRef(null);

  useEffect(() => {
    // Focus only when editingField changes from null to a value (edit starts)
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

  const handleSave = () => {
    if (editingField === 'intraday') {
        onUpdateIntradayAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
    } else if (editingField === 'overnight') {
        onUpdateOvernightAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
    } else if (editingField === 'option') {
        onUpdateOptionAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
        if (Number(tempPercentage) !== optionPercentage) {
          onUpdateOptionPercentage(Number(tempPercentage));
        }
    } else if (editingField === 'mcx') {
        onUpdateMcxAll(Number(tempAvailable), Number(tempFree), Number(tempUsed));
        if (Number(tempPercentage) !== mcxPercentage) {
          onUpdateMcxPercentage(Number(tempPercentage));
        }
    }
    setEditingField(null);
  };

  const renderMarginSection = (title, available, used, free, accentColor, Icon, fieldKey) => (
    <div key={fieldKey} className="margin-section-group p-4 bg-[var(--bg-primary)]/50 rounded-2xl border border-[var(--border-color)]/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${accentColor} bg-opacity-10`}>
            <Icon size={16} className={accentColor.replace('bg-', 'text-')} />
          </div>
          <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{title}</h4>
        </div>
        {isBroker && editingField !== fieldKey && !fieldKey.includes('readonly') && (
          <button 
            onClick={() => startEdit(fieldKey, available, free, used, fieldKey === 'mcx' ? mcxPercentage : optionPercentage)}
            className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-blue-500/5 rounded-lg transition-all"
          >
            <Pencil size={12} />
          </button>
        )}
        {isBroker && editingField === fieldKey && (
          <div className="flex items-center gap-1">
            <button onClick={handleSave} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><Check size={14} /></button>
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
              ref={firstInputRef}
              type="number" 
              value={tempAvailable}
              onChange={(e) => {
                const val = e.target.value;
                setTempAvailable(val);
                const numVal = Number(val);
                const numUsed = Number(tempUsed) || 0;
                setTempFree(String(Math.max(0, numVal - numUsed)));
              }}
              className={`bg-transparent border-b ${fieldKey === 'option' || fieldKey === 'mcx' ? 'border-amber-500' : 'border-blue-500'} text-[12px] font-bold outline-none text-[var(--text-primary)] w-24 text-right`}
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
                 <span className="text-[11px] font-bold">Option Percentage (%)</span>
               </div>
               <input 
                  type="number" 
                  value={tempPercentage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTempPercentage(val);
                    const pct = Number(val) || 0;
                    // Calculate dynamic available based on (intradayMargin + deliveryMargin)
                    const totalBaseMargin = (intradayMargin || 0) + (deliveryMargin || 0);
                    const dynamicAvailable = totalBaseMargin * (pct / 100);
                    setTempAvailable(String(dynamicAvailable));
                    
                    const numUsed = Number(tempUsed) || 0;
                    setTempFree(String(Math.max(0, dynamicAvailable - numUsed)));
                  }}
                  className="bg-transparent border-b border-amber-500 text-[12px] font-bold outline-none text-amber-500 w-24 text-right"
                />
            </div>
        )}

        {fieldKey === 'mcx' && editingField === fieldKey && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-color)]/20">
               <div className="flex items-center gap-2 text-amber-500">
                 <PieChart size={12} className="opacity-80" />
                 <span className="text-[11px] font-bold">MCX Percentage (%)</span>
               </div>
               <input 
                  type="number" 
                  value={tempPercentage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTempPercentage(val);
                    const pct = Number(val) || 0;
                    const totalBaseMargin = (intradayMargin || 0) + (deliveryMargin || 0);
                    const dynamicAvailable = totalBaseMargin * (pct / 100);
                    setTempAvailable(String(dynamicAvailable));
                    
                    const numUsed = Number(tempUsed) || 0;
                    setTempFree(String(Math.max(0, dynamicAvailable - numUsed)));
                  }}
                  className="bg-transparent border-b border-amber-500 text-[12px] font-bold outline-none text-amber-500 w-24 text-right"
                />
            </div>
        )}
      </div>
      
      {/* Progress bar at the bottom */}
      <div className="mt-4 h-1 w-full bg-[var(--border-color)]/20 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 bg-blue-500`} 
          style={{ width: available > 0 ? `${(used/available)*100}%` : '0%' }}
        />
      </div>
    </div>
  );

  return (
    <div className="details-container-card animate-up" style={{ animationDelay: '0.3s' }}>
      <div className="details-header-row mb-6">
        <ShieldCheck className="text-blue-500" size={20} />
        <span className="font-black tracking-tight text-[15px]">Trading Margin Details</span>
      </div>

      <div className="space-y-4">
        {renderMarginSection(
          "Intraday Trading Margin",
          intradayMargin,
          intradayUsed,
          intradayFree,
          "bg-blue-500",
          Activity,
          "intraday"
        )}

        {/* {renderMarginSection(
          "Delivery / Overnight Margin",
          deliveryMargin,
          deliveryUsed,
          deliveryFree,
          "bg-emerald-500",
          Briefcase,
          "overnight"
        )}  */}

        {renderMarginSection(
          `Option Limit (${optionPercentage}%)`,
          finalOptionAvailable,
          finalOptionUsed,
          finalOptionFree,
          "bg-amber-500",
          PieChart,
          "option"
        )}

        {/* {renderMarginSection(
          `MCX Limit (${mcxPercentage}%)`,
          finalMcxAvailable,
          finalMcxUsed,
          finalMcxFree,
          "bg-purple-500",
          PieChart,
          "mcx"
        )} */}
      </div>
    </div>
  );
}
