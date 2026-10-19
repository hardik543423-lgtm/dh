import React from 'react';
import { Plus, Download, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import LockedButtonWrapper from '../../../components/LockedButtonWrapper';

export default function ActionButtons() {
  const navigate = useNavigate();
  
  return (
    <div className="action-grid-top animate-up" style={{ animationDelay: '0.1s' }}>
      <LockedButtonWrapper featureId="withdraw_funds">
        <button 
          onClick={() => navigate('/funds/withdraw')}
          className="top-btn btn-withdraw w-full text-xs"
        >
          <Download size={14} className="rotate-180" /> Withdraw
        </button>
      </LockedButtonWrapper>

      <LockedButtonWrapper featureId="add_funds">
        <button 
          onClick={() => navigate('/funds/add')}
          className="top-btn btn-add w-full text-xs"
        >
          <Plus size={14} /> Add Funds
        </button>
      </LockedButtonWrapper>

      <button 
        onClick={() => navigate('/funds/mcx')}
        className="top-btn btn-withdraw w-full text-xs"
        style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
      >
        <BarChart2 size={14} className="text-purple-500" /> MCX Fund
      </button>
    </div>
  );
}
