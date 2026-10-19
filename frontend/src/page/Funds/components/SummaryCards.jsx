import React, { useState } from 'react';
import { Landmark, TrendingUp, Zap, Pencil, Check, X } from 'lucide-react';
import { formatCurrency } from '../FundHelpers';

export default function SummaryCards({ 
  depositedCash, 
  depositMargin, 
  totalMargin,
  isBroker, 
  onUpdateBalance, 
  onUpdateMargin,
  onUpdateIntradayTotal 
}) {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [isEditingMargin, setIsEditingMargin] = useState(false);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  
  const [tempBalance, setTempBalance] = useState(depositedCash);
  const [tempMargin, setTempMargin] = useState(depositMargin);
  const [tempTotal, setTempTotal] = useState(totalMargin);

  const handleBalanceSave = () => {
    onUpdateBalance(Number(tempBalance));
    setIsEditingBalance(false);
  };

  const handleMarginSave = () => {
    onUpdateMargin(Number(tempMargin));
    setIsEditingMargin(false);
  };

  const handleTotalSave = () => {
    // Top card "Net Available Balance (Cash)" updates the core intraday limit
    if (onUpdateIntradayTotal) {
      onUpdateIntradayTotal(Number(tempTotal));
    } else {
      onUpdateBalance(Number(tempTotal));
    }
    setIsEditingTotal(false);
  };

  return (
    <div className="space-y-4 animate-up" style={{ animationDelay: '0.2s' }}>
      
      {/* 1. Net Available Balance (Main Theme Card) */}
      <div className="large-card dark-card relative overflow-hidden min-h-[140px] flex flex-col justify-between">
        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
          <Landmark size={84} className="text-white" />
        </div>
        
        <div>
          <span className="stat-label text-white/80">Net Available Balance (Cash)</span>
          {isEditingTotal ? (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="number" 
                value={tempTotal}
                onChange={(e) => setTempTotal(e.target.value)}
                className="bg-transparent border-b-2 border-white/50 text-3xl font-black outline-none text-white w-full"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <button onClick={handleTotalSave} className="p-2 bg-white/20 text-white rounded-xl hover:bg-white/30"><Check size={18} /></button>
                <button onClick={() => setIsEditingTotal(false)} className="p-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <h2 className="stat-value text-white text-4xl mt-1">{formatCurrency(totalMargin)}</h2>
          )}
        </div>

        <div className="flex items-end justify-between mt-4">
          <div className="flex-1">
             {isBroker && !isEditingTotal && (
              <button 
                onClick={() => { setTempTotal(totalMargin); setIsEditingTotal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 border-b border-b-white/10"
              >
                <Pencil size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Edit Balance</span>
              </button>
            )}
          </div>
          <span className="sub-label text-white/60 text-right">Trading power (Cash)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* 2. Deposited Cash Card */}
        <div className="large-card !py-5 !px-6 bg-[var(--bg-secondary)] flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between">
            <span className="stat-label !mb-0">Deposited Cash</span>
            <div className="p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]/50">
              <Landmark size={18} className="text-[var(--text-muted)]" />
            </div>
          </div>
          
          {isEditingBalance ? (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="number" 
                value={tempBalance}
                onChange={(e) => setTempBalance(e.target.value)}
                className="bg-transparent border-b-2 border-blue-500 text-2xl font-bold outline-none text-[var(--text-primary)] w-full"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <button onClick={handleBalanceSave} className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg"><Check size={18} /></button>
                <button onClick={() => setIsEditingBalance(false)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <h2 className="stat-value !text-2xl mt-2">{formatCurrency(depositedCash)}</h2>
          )}

          <div className="mt-4">
            {isBroker && !isEditingBalance && (
              <button 
                onClick={() => { setTempBalance(depositedCash); setIsEditingBalance(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-muted)] hover:text-blue-500 bg-[var(--bg-primary)] hover:bg-blue-500/5 rounded-lg border border-[var(--border-color)] transition-all"
              >
                <Pencil size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Deposit Margin Card (Realized P&L) */}
        <div className="large-card !py-5 !px-6 bg-[var(--bg-secondary)] flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between">
            <span className="stat-label !mb-0">Deposit Margin</span>
            <div className="p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]/50">
              <TrendingUp size={18} className="text-[var(--text-muted)]" />
            </div>
          </div>
          
          {isEditingMargin ? (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="number" 
                value={tempMargin}
                onChange={(e) => setTempMargin(e.target.value)}
                className="bg-transparent border-b-2 border-red-500 text-2xl font-bold outline-none text-[var(--text-primary)] w-full"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <button onClick={handleMarginSave} className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg"><Check size={18} /></button>
                <button onClick={() => setIsEditingMargin(false)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <h2 className={`stat-value !text-2xl mt-2 ${depositMargin < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {formatCurrency(depositMargin)}
            </h2>
          )}

          <div className="mt-4">
            {isBroker && !isEditingMargin && (
              <button 
                onClick={() => { setTempMargin(depositMargin); setIsEditingMargin(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-muted)] hover:text-red-500 bg-[var(--bg-primary)] hover:bg-red-500/5 rounded-lg border border-[var(--border-color)] transition-all"
              >
                <Pencil size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
