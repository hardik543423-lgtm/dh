import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Landmark, Smartphone, QrCode, Upload, Check, Pencil, X, Building2, Send, Copy, Phone } from 'lucide-react';
import { formatCurrency } from './FundHelpers';

export default function AddFundsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fundsData, setFundsData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Context
  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const isBroker = userObject.role === 'broker';

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
  const urlParams = new URLSearchParams(window.location.search);
  const urlCustomerId = urlParams.get('customerId');
  
  // Identity Logic: Use context for broker managing customer, or userObject for direct customer
  const brokerId = isBroker 
    ? (activeContext.brokerId || globalBrokerId) 
    : (userObject.brokerId || activeContext.brokerId || globalBrokerId);
  const customerId = isBroker 
    ? (activeContext.customerId || urlCustomerId) 
    : (userObject.id || activeContext.customerId || urlCustomerId);
  
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  // Form State (For Broker)
  const [formData, setFormData] = useState({
    broker_number: '',
    bank_name: '',
    ifsc: '',
    holder_name: '',
    account_number: '',
    qr_code: ''
  });

  // User Request State
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank');

  const fetchData = async () => {
    if (!brokerId || !customerId) {
      console.error("Missing ID context", { brokerId, customerId });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data) {
        setFundsData(result.data);
        if (result.data.payment_details) {
          setFormData(result.data.payment_details);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [brokerId, customerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/funds/updatePaymentDetails`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          broker_id_str: brokerId,
          customer_id_str: customerId,
          payment_details: formData
        })
      });
      const result = await res.json();
      if (result.success) {
        setIsEditing(false);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestFund = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    setRequesting(true);
    try {
      console.log("Sending request...", { brokerId, customerId, amount });
      const res = await fetch(`${apiBase}/api/transactions/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          broker_id_str: brokerId,
          customer_id_str: customerId,
          type: 'deposit',
          amount: Number(amount),
          payment_method: paymentMethod,
          proof_image: formData.qr_code
        })
      });
      
      const result = await res.json();
      console.log("Request result:", result);
      
      if (result.success) {
        setAmount('');
        alert(`Request Sent Successfully! Fund of ${formatCurrency(amount)} will be added after broker verification.`);
      } else {
        alert("Request Failed: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Request error:", error);
      alert("System Error: Could not send request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, qr_code: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const SkeletonLoader = () => (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="skeleton skeleton-badge" style={{ width: '40px', height: '40px' }} />
        <div className="skeleton skeleton-title" style={{ width: '150px' }} />
      </div>
      <div className="skeleton skeleton-card" style={{ height: '120px' }} />
      <div className="skeleton skeleton-card" style={{ height: '250px' }} />
      <div className="skeleton skeleton-card" style={{ height: '200px' }} />
    </div>
  );

  if (loading) return <SkeletonLoader />;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-10 font-sans">
      {/* Header */}
      <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/funds')} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Add Funds</h1>
        </div>
        {isBroker && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              isEditing ? 'bg-blue-600 text-white shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
            }`}
          >
            {isEditing ? (saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Check size={16} /> Save</>) : <><Pencil size={16} /> Edit Details</>}
          </button>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
        {/* Amount Input Section (Customer Only) */}
        {!isEditing && (
          <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm animate-up">
            <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-4 block">Amount to Add</label>
            <div className="flex items-center gap-2 pb-2 border-b-2 border-[var(--border-light)] focus-within:border-blue-500 transition-colors">
              <span className="text-2xl font-bold text-[var(--text-muted)]">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-3xl font-bold outline-none bg-transparent placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="flex gap-2 mt-6 overflow-x-auto no-scrollbar">
              {['1000', '5000', '10000', '25000'].map(val => (
                <button 
                  key={val} 
                  onClick={() => setAmount(prev => (Number(prev || 0) + Number(val)).toString())}
                  className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[11px] font-bold text-[var(--text-secondary)] hover:border-blue-500 hover:text-blue-600 transition-all whitespace-nowrap"
                >
                  + ₹{Number(val).toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment Method Selector (Customer Only) */}
        {!isEditing && (
          <div className="grid grid-cols-2 gap-3 animate-up" style={{ animationDelay: '0.1s' }}>
            <MethodTab 
              active={paymentMethod === 'bank'} 
              onClick={() => setPaymentMethod('bank')}
              icon={<Building2 size={18} />}
              label="Bank Transfer"
            />
            <MethodTab 
              active={paymentMethod === 'upi'} 
              onClick={() => setPaymentMethod('upi')}
              icon={<QrCode size={18} />}
              label="UPI / QR"
            />
          </div>
        )}

        {/* Dynamic Details Content */}
        <div className="space-y-6 animate-up" style={{ animationDelay: '0.2s' }}>
          
          {(paymentMethod === 'bank' || isEditing) && (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center gap-2 bg-[var(--bg-secondary)]/50">
                <Landmark size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Bank Transfer Details</h3>
              </div>
              <div className="p-5 space-y-4">
                {isEditing ? (
                  <>
                    <InputGroup label="Bank Name" value={formData.bank_name} onChange={(v) => setFormData({ ...formData, bank_name: v })} />
                    <InputGroup label="Account Holder" value={formData.holder_name} onChange={(v) => setFormData({ ...formData, holder_name: v })} />
                    <InputGroup label="Account Number" value={formData.account_number} onChange={(v) => setFormData({ ...formData, account_number: v })} />
                    <InputGroup label="IFSC Code" value={formData.ifsc} onChange={(v) => setFormData({ ...formData, ifsc: v })} />
                  </>
                ) : (
                  formData.account_number ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <DataBox label="Bank" value={formData.bank_name} />
                        <DataBox label="IFSC" value={formData.ifsc} />
                      </div>
                      <DataBox label="Account Holder" value={formData.holder_name} />
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between group">
                        <div>
                          <span className="text-[10px] text-blue-400 font-bold uppercase block mb-1">Account Number</span>
                          <span className="text-xl font-bold text-blue-600 tracking-tight">{formData.account_number}</span>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(formData.account_number);
                            alert("Account number copied!");
                          }}
                          className="p-2 bg-[var(--bg-card)] rounded-lg border border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  ) : <EmptyState message="No bank details added." />
                )}
              </div>
            </div>
          )}

          {(paymentMethod === 'upi' || isEditing) && (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center gap-2 bg-[var(--bg-secondary)]/50">
                <QrCode size={18} className="text-purple-600" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Scan QR Code</h3>
              </div>
              <div className="p-8 flex flex-col items-center justify-center">
                {formData.qr_code ? (
                  <div className="relative">
                    <img src={formData.qr_code} alt="QR" className="w-44 h-44 object-contain rounded-xl border border-[var(--border-color)] p-2 shadow-sm" />
                    {isEditing && (
                      <button 
                        onClick={() => setFormData({ ...formData, qr_code: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  isEditing ? (
                    <label className="w-44 h-44 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors">
                      <Upload size={24} className="text-[var(--text-muted)] mb-2" />
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Upload QR</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  ) : <EmptyState message="No QR code available." />
                )}
              </div>
            </div>
          )}

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center gap-2 bg-[var(--bg-secondary)]/50">
              <Phone size={18} className="text-emerald-600" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Broker Support</h3>
            </div>
            <div className="p-5">
              {isEditing ? (
                <InputGroup label="Phone Number" value={formData.broker_number} onChange={(v) => setFormData({ ...formData, broker_number: v })} />
              ) : (
                formData.broker_number ? (
                  <div className="flex items-center justify-between bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{formData.broker_number}</span>
                    <a href={`tel:${formData.broker_number}`} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 shadow-sm">
                      <Phone size={14} /> Call Now
                    </a>
                  </div>
                ) : <EmptyState message="No contact number." />
              )}
            </div>
          </div>
        </div>

        {/* Final Action Button */}
        {!isEditing && (
          <div className="pt-4 animate-up" style={{ animationDelay: '0.3s' }}>
            <button 
              onClick={handleRequestFund}
              disabled={!amount || requesting}
              className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all ${
                !amount ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-95'
              }`}
            >
              {requesting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send size={18} /> Request to Add Fund</>}
            </button>
            <p className="text-[10px] text-center text-[var(--text-muted)] mt-4 font-medium italic">
              * Verification may take up to 24 hours. Keep payment screenshot ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MethodTab({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
        active ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-sm' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
      }`}
    >
      <div className={`mb-2 p-2 rounded-lg ${active ? 'bg-blue-600 text-white' : 'bg-[var(--bg-secondary)]'}`}>{icon}</div>
      <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function DataBox({ label, value }) {
  if (!value) return null;
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3">
      <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block mb-1">{label}</span>
      <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function InputGroup({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{label}</label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] px-4 py-3 rounded-xl outline-none text-sm font-semibold focus:border-blue-500 focus:bg-[var(--bg-card)] text-[var(--text-primary)] transition-all"
        placeholder={`Enter ${label}...`}
      />
    </div>
  );
}

function EmptyState({ message }) {
  return <p className="text-[11px] text-[var(--text-muted)] font-medium text-center py-2">{message}</p>;
}
