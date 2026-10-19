import React, { useState, useEffect } from 'react';
import { Pencil, Check, X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FundsHeader({ customerId, brokerPhone, isBroker, onUpdatePhone }) {
  const navigate = useNavigate();
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState(brokerPhone);
  const [hasNewRequests, setHasNewRequests] = useState(false);

  useEffect(() => {
    setTempPhone(brokerPhone);
  }, [brokerPhone]);

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  
  // Robust identity logic for Notifications
  const brokerId = userRole === 'broker' ? activeContext.brokerId : (userObject.brokerId || activeContext.brokerId);
  const customerIdForNotif = userRole === 'broker' ? activeContext.customerId : (userObject.id || activeContext.customerId);

  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  useEffect(() => {
    setTempPhone(brokerPhone);
  }, [brokerPhone]);

  useEffect(() => {
    const checkRequests = async () => {
      if (!brokerId || !customerIdForNotif) return;
      try {
        const url = `${apiBase}/api/transactions/history?broker_id_str=${brokerId}&customer_id_str=${customerIdForNotif}&status=pending`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success && result.data.length > 0) {
          setHasNewRequests(true);
        } else {
          setHasNewRequests(false);
        }
      } catch (error) {
        console.error(error);
      }
    };
    
    checkRequests();
    const interval = setInterval(checkRequests, 30000);
    return () => clearInterval(interval);
  }, [brokerId, customerIdForNotif, token, apiBase]);

  const handleSave = () => {
    onUpdatePhone(tempPhone);
    setIsEditingPhone(false);
  };

  return (
    <div className="section-header px-1 animate-up">
      <div className="flex justify-between items-start">
        <div>
          <h1>Account Funds</h1>
          {/* <p>Manage your deposits, margin, and available buying power.</p> */}
        </div>
        
        {/* Notification Bell - Now for both Broker and Customer */}
        <button 
          onClick={() => navigate('/funds/requests')}
          className="relative p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-primary)] transition-all active:scale-95 group"
        >
          <Bell size={20} className="text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors" />
          {hasNewRequests && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-[var(--bg-secondary)] rounded-full animate-pulse"></span>
          )}
        </button>
      </div>
      
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {customerId && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] px-4 py-1.5 rounded-2xl shadow-sm flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-secondary)] font-extrabold uppercase tracking-widest opacity-60">ID</span>
            <span className="text-xs font-bold text-[var(--text-primary)]">{customerId}</span>
          </div>
        )}
        
        <div className="flex-1" />

        {isBroker ? (
          <div className="flex items-center gap-1.5">
            {isEditingPhone ? (
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-blue-500/50 px-3 py-1.5 rounded-2xl shadow-lg">
                <input 
                  type="number" 
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none text-[var(--text-primary)] w-24"
                  autoFocus
                />
                <button onClick={handleSave} className="text-emerald-500 hover:scale-110 transition-transform"><Check size={14} /></button>
                <button onClick={() => setIsEditingPhone(false)} className="text-red-500 hover:scale-110 transition-transform"><X size={14} /></button>
              </div>
            ) : (
              <div 
                className="bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-2xl flex items-center gap-2 cursor-pointer hover:bg-blue-600/20 transition-all active:scale-95 group"
                onClick={() => { setTempPhone(brokerPhone); setIsEditingPhone(true); }}
              >
                <span className="text-[11px] text-blue-500 font-extrabold uppercase tracking-wider">Support</span>
                <span className="text-xs font-bold text-blue-600">{brokerPhone || "Not Set"}</span>
                <Pencil size={10} className="text-blue-500 opacity-50 group-hover:opacity-100" />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-blue-500/5 border border-blue-500/10 px-4 py-1.5 rounded-2xl flex items-center gap-2">
            <span className="text-[11px] text-blue-500 font-extrabold uppercase tracking-wider">Support</span>
            <span className="text-xs font-bold text-blue-600">{brokerPhone || "Not Set"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
