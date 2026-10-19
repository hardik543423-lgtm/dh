import React from 'react';
import { formatCurrency } from '../FundHelpers';
import { ChevronRight } from 'lucide-react';

export default function MarginUsage({ usedAmount, totalAmount }) {
  const percentage = totalAmount > 0 ? Math.min(100, (usedAmount / totalAmount) * 100) : 0;
  
  return (
    <div className="px-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="glass-card">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Margin Used</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">{percentage.toFixed(0)}%</span>
        </div>
        
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between items-end mt-2">
          <span className="text-base font-bold text-[var(--text-primary)]">{formatCurrency(usedAmount)}</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            of {formatCurrency(totalAmount)}
          </span>
        </div>

        <button className="w-full mt-6 flex items-center justify-center gap-2 text-blue-500 font-bold text-sm hover:opacity-80 transition-opacity border-t border-[var(--border-color)] pt-4">
          View Statement <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
