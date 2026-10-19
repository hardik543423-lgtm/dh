import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  User, Shield, IdCard, LogOut, UserCheck, Moon, Sun, Loader2, Camera,
  ChevronRight, BookOpen, CreditCard, HelpCircle, Info, Settings,
  CheckCircle, Building2, Pencil, X, Download, PlusCircle, Lock, History, Key
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { usePWA } from "../../contexts/PWAContext";
import LandingPage from "../Landing/LandingPage.jsx";

export default function Profile() {
  const [showAbout, setShowAbout] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme, isDark } = useTheme();
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { isInstallable, isStandalone, installPWA } = usePWA();

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdMessage, setPwdMessage] = useState(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPwd || !newPwd) return;
    setPwdSubmitting(true);
    setPwdMessage(null);

    try {
      const res = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwdMessage({ success: true, text: "Password updated successfully!" });
        setOldPwd("");
        setNewPwd("");
      } else {
        setPwdMessage({ success: false, text: data.message || "Failed to update password." });
      }
    } catch (err) {
      setPwdMessage({ success: false, text: "Network error occurred." });
    } finally {
      setPwdSubmitting(false);
    }
  };

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  // ---------- READ USER & CONTEXT ----------
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {
    loggedInUser = null;
  }

  const role = loggedInUser?.role || "customer";
  const userName = loggedInUser?.name || "User";
  const brokerIdStr = localStorage.getItem("associatedBrokerStringId") || "";

  let activeContext = null;
  try {
    activeContext = JSON.parse(localStorage.getItem("activeContext") || "null");
  } catch {
    activeContext = null;
  }

  const activeCustomerId = activeContext?.customerId || null;
  const customerId = role === "customer" ? loggedInUser?.id : null;
  const customerName = (role === 'broker' && activeCustomerId)
    ? localStorage.getItem('customerName')
    : null;

  const urlCustomerId = searchParams.get("customerId");
  const viewingCustomerId = urlCustomerId || activeCustomerId;
  const isBrokerViewingCustomer = role === "broker" && viewingCustomerId;

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!viewingCustomerId || !token) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/auth/customer/${viewingCustomerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomerData(data.customer);
        }
      } catch (error) {
        console.error("Failed to fetch customer data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomerData();
  }, [viewingCustomerId, token, apiBase]);

  const handleInstallClick = async () => {
    const success = await installPWA();
    if (!success) {
      alert("App installation is not supported by your browser or already installed. You can manually 'Add to Home Screen' from browser menu.");
    }
  };

  const handleLogout = () => {
    if (token) {
      fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => { });
    }
    const keepBrokerId = brokerIdStr;
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("activeContext");
    localStorage.removeItem("customerName");
    localStorage.setItem("associatedBrokerStringId", keepBrokerId);
    if (keepBrokerId) {
      navigate(`/broker/${keepBrokerId}/customerDetail`, { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  const displayName = customerData?.name || userName;
  const displayId =  customerId || brokerIdStr;
  const joiningDate = customerData?.joining_date || "N/A";

  // Menu items
  const menuItems = [
    { icon: BookOpen, label: "Order Book", onClick: () => navigate("/orders") },
    { icon: CreditCard, label: "Payments", onClick: () => navigate("/funds") },
    ...(isBrokerViewingCustomer ? [
      { 
        icon: PlusCircle, 
        label: "Custome Close Order", 
        onClick: () => navigate(`/orders/add-closed-order?customerId=${viewingCustomerId}`) 
      },
      { 
        icon: Shield, 
        label: "Feature Controls", 
        onClick: () => navigate(`/profile/permissions?customerId=${viewingCustomerId}`) 
      },
      { 
        icon: Settings, 
        label: "Advance Jobbing", 
        onClick: () => navigate(`/profile/advance-jobbing?customerId=${viewingCustomerId}`) 
      }
    ] : []),
   
    { icon: Info, label: "About", onClick: () => setShowAbout(true) },
    
  ];

  if (showAbout) {
    return (
      <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] overflow-y-auto">
        <LandingPage isAboutMode={true} onClose={() => setShowAbout(false)} />
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between px-4 py-3 max-w-xl mx-auto">
          <h1 className="text-xl font-bold tracking-tight">Profile</h1>
          {isBrokerViewingCustomer && (
            <button
              onClick={() => navigate(`/broker/${brokerIdStr}/customerDetail`)}
              className="text-sm text-indigo-500 font-semibold hover:text-indigo-400 transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">

        {/* ═══════════ PROFILE CARD ═══════════ */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4">
              {/* Profile Photo (Static Logo Only) */}
              <div className="relative">
                <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-[#1e222d] flex items-center justify-center border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                  <img src="/image.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold capitalize truncate">{displayName}</h2>
                <p className="text-sm text-[var(--text-secondary)] capitalize">
                  {role === "broker" ? "Broker" : "Customer"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {role === "broker" ? "Broker" : "Client"} ID: <span className="font-semibold text-[var(--text-secondary)]">{displayId}</span>
                </p>

                {role === 'broker' && customerName && (
                  <p className="text-xs text-indigo-400 mt-1 font-medium">
                    Viewing: {customerName}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ KYC VERIFICATION CARD ═══════════ */}
        {/* {role === "customer" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">KYC Verification</h3>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Verified
              </span>
            </div>

            <div className="flex justify-around">
              {["Aadhaar", "PAN", "Bank"].map((item) => (
                <div key={item} className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{item}</span>
                </div>
              ))}
            </div>

            <button className="mt-4 text-sm text-indigo-500 font-semibold flex items-center gap-1 mx-auto hover:text-indigo-400 transition-colors">
              View KYC <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )} */}

        {/* ═══════════ BROKER/CUSTOMER DETAILS ═══════════ */}
        {(isBrokerViewingCustomer || (role === "broker" && !isBrokerViewingCustomer)) && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm p-5">
            <h3 className="text-base font-bold mb-3">Details</h3>
            <div className="space-y-0">
              {isBrokerViewingCustomer && (
                <>
                  <DetailRow icon={IdCard} label="Customer ID" value={viewingCustomerId} />
                  <DetailRow icon={User} label="Customer Name" value={customerData?.name} />
                  <DetailRow icon={UserCheck} label="Joining Date" value={joiningDate} />
                  <DetailRow icon={Lock} label="Current Password" value={customerData?.password} />
                  {customerData?.old_password && (
                    <DetailRow icon={History} label="Old Password" value={customerData?.old_password} />
                  )}
                </>
              )}
              {role === "broker" && !isBrokerViewingCustomer && (
                <>
                  <DetailRow icon={Shield} label="Broker ID" value={brokerIdStr} />
                  {activeCustomerId && (
                    <DetailRow icon={UserCheck} label="Viewing Customer" value={activeCustomerId} />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ BANK ACCOUNT CARD ═══════════ */}
        {/* {role === "customer" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm p-5">
            <h3 className="text-base font-bold mb-3">Bank Account</h3>
            <div className="flex items-center gap-3 bg-[var(--bg-primary)] rounded-xl p-3 border border-[var(--border-color)]">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Building2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Bank Account</span>
                  <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                    Primary
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">****{displayId?.slice(-4) || "0000"}</span>
              </div>
              <button className="flex items-center gap-1 text-indigo-500 text-sm font-semibold hover:text-indigo-400 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
        )} */}

        {/* ═══════════ CHANGE PASSWORD (CUSTOMER ONLY) ═══════════ */}
        {role === "customer" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm p-5">
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" /> Change Password
            </h3>
            {pwdMessage && (
              <p className={`text-xs mb-3 font-semibold ${pwdMessage.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {pwdMessage.text}
              </p>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Old Password</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="Enter old password"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                  disabled={pwdSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">New Password</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                  disabled={pwdSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={pwdSubmitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
              >
                {pwdSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* ═══════════ MENU ITEMS ═══════════ */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-[var(--bg-hover)] transition-colors duration-150 ${
                index !== menuItems.length - 1 ? 'border-b border-[var(--border-color)]' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)]">
                <item.icon className="w-[18px] h-[18px] text-[var(--text-secondary)]" />
              </div>
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          ))}
        </div>

        {/* ═══════════ THEME TOGGLE ═══════════ */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)]">
                {isDark ? <Moon className="w-[18px] h-[18px] text-indigo-400" /> : <Sun className="w-[18px] h-[18px] text-amber-400" />}
              </div>
              <span className="text-sm font-medium">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* ═══════════ PWA INSTALL / LOGOUT / BACK BUTTON ═══════════ */}
        {(!isStandalone) && (
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-semibold shadow-lg shadow-indigo-500/20 transition-all duration-200 text-white active:scale-[0.98] mb-3"
          >
            <Download className="w-5 h-5" /> {isInstallable ? "Install APK" : "Download APK"}
          </button>
        )}

        {isBrokerViewingCustomer && (
          <button
            onClick={() => navigate(`/broker/${brokerIdStr}/customerDetail`)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] font-semibold shadow-sm transition-all duration-200 text-[var(--text-primary)] mb-3"
          >
            ← Back to Customers
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 font-semibold shadow-lg shadow-red-500/20 transition-all duration-200 text-white active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>

        {/* App version footer */}
        <p className="text-center text-xs text-[var(--text-muted)] pb-2">
          APK v1.8.8
        </p>
      </div>
    </div>
  );
}

/* ──── Detail Row Component ──── */
function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-color)] last:border-none">
      <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-[var(--text-primary)] font-semibold text-sm">{value || "—"}</span>
    </div>
  );
}