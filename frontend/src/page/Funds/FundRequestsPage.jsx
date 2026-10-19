import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X, User, ArrowUpRight, ArrowDownLeft, Clock, Search, Filter, History } from 'lucide-react';
import { formatCurrency } from './FundHelpers';

export default function FundRequestsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending, all
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const isBroker = userObject.role === 'broker';

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Both Broker and Customer now only see transactions for the ACTIVE customer in context
      const url = `${apiBase}/api/transactions/history?broker_id_str=${brokerId}&customer_id_str=${customerId}${filter === 'pending' ? '&status=pending' : ''}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setRequests(result.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter, isBroker]);

  const handleStatusUpdate = async (id, newStatus) => {
    if (!isBroker) return; // Safety check
    setProcessingId(id);
    try {
      const res = await fetch(`${apiBase}/api/transactions/updateStatus`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ transaction_id: id, status: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        fetchRequests();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = isBroker 
    ? requests.filter(r => r.customer_id_str.toLowerCase().includes(searchTerm.toLowerCase()))
    : requests;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] pb-20 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/funds')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{isBroker ? 'Fund Requests' : 'Your Requests'}</h1>
        </div>

        {/* Search & Tabs (Only for Broker) */}
        {isBroker ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search Client ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilter('pending')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                Pending
              </button>
              <button 
                onClick={() => setFilter('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                All Requests
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
            <History size={16} className="text-blue-500" />
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Your Transaction Status History</p>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
          </div>
        ) : filteredRequests.length > 0 ? (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <div key={req._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-up">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400">
                      <User size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{req.customer_id_str}</span>
                  </div>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${req.type === 'deposit' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    {req.type}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Amount</p>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(req.amount)}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Time</p>
                      <p className="text-[11px] font-bold text-slate-600">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Reason</p>
                      <p className="text-xs font-medium text-slate-600 italic">"{req.reason}"</p>
                    </div>
                  )}

                  {isBroker && req.status === 'pending' ? (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => handleStatusUpdate(req._id, 'rejected')}
                        disabled={processingId === req._id}
                        className="flex items-center justify-center gap-2 py-3 border border-red-100 text-red-500 bg-red-50 font-bold text-xs rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        <X size={16} /> Reject
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(req._id, 'verified')}
                        disabled={processingId === req._id}
                        className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        <Check size={16} /> Approve
                      </button>
                    </div>
                  ) : (
                    <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-[11px] uppercase tracking-wider ${
                      req.status === 'verified' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                      req.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-500' :
                      'bg-red-50 border-red-100 text-red-500'
                    }`}>
                      {req.status === 'verified' ? <Check size={14} /> : req.status === 'pending' ? <Clock size={14} /> : <X size={14} />} {req.status}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Clock size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">No requests found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
