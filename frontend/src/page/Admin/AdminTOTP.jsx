import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  RefreshCw, LogOut, Key, Shield, Copy, Check, 
  Settings, Save, AlertCircle, Clock, Lock, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminTOTP = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [totp, setTotp] = useState('');
    const [timeLeft, setTimeLeft] = useState(30);
    const [loading, setLoading] = useState(true);
    const [setupLoading, setSetupLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [copied, setCopied] = useState(false);
    const [autoLoginStatus, setAutoLoginStatus] = useState(null);

    // Form states
    const [password, setPassword] = useState('');
    const [totpSecret, setTotpSecret] = useState('');

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || '';
    const timerRef = useRef(null);

    // Get auth token
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    // Check if user is admin
    useEffect(() => {
        const userStr = localStorage.getItem('loggedInUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.role !== 'admin') {
                navigate('/login');
            }
        } else {
            navigate('/login');
        }
    }, [navigate]);

    // Fetch TOTP and Status
    const fetchData = async () => {
        try {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            // Fetch Status
            const statusRes = await fetch(`${apiBase}/api/kite/auto-login/status`, { headers });
            const statusData = await statusRes.json();
            if (statusData.success) {
                setAutoLoginStatus(statusData);
            }

            // Fetch TOTP
            await fetchTOTP();
        } catch (err) {
            console.error('[AdminTOTP] Error:', err);
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const fetchTOTP = async () => {
        try {
            const res = await fetch(`${apiBase}/api/kite/totp/generate`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTotp(data.token);
                setTimeLeft(data.timeRemaining);
            } else {
                setTotp('');
            }
        } catch (err) {
            console.error('[AdminTOTP] TOTP Error:', err);
        }
    };

    useEffect(() => {
        fetchData();

        // Timer for countdown
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    fetchTOTP();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, []);

    const handleSetup = async (e) => {
        e.preventDefault();
        setSetupLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${apiBase}/api/kite/auto-login/setup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password, totp_secret: totpSecret })
            });

            const data = await res.json();
            if (data.success) {
                setSuccess('Credentials updated successfully!');
                setPassword('');
                setTotpSecret('');
                fetchData();
            } else {
                setError(data.error || 'Failed to update credentials');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setSetupLoading(false);
        }
    };

    const handleCopy = () => {
        if (!totp) return;
        navigator.clipboard.writeText(totp);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const tabs = [
        { label: 'Registrations', path: '/admin/registrations' },
        { label: 'Access Token', path: '/admin/access-token' },
        { label: 'TOTP', path: '/admin/totp' },
        { label: 'Logs', path: '/admin/logs' },
    ];

    const progress = (timeLeft / 30) * 100;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                        Admin Control
                    </h1>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.path}
                            onClick={() => navigate(tab.path)}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                              location.pathname === tab.path
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-6">
                <AnimatePresence>
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-400"
                        >
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">{error}</p>
                        </motion.div>
                    )}

                    {success && (
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 text-green-400"
                        >
                            <Check className="w-5 h-5" />
                            <p className="text-sm font-medium">{success}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* TOTP Generator Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-xl"
                    >
                        <div className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 p-6 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <Shield className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Live TOTP</h2>
                                    <p className="text-xs text-[var(--text-muted)]">Kite System Account</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                            {loading ? (
                                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
                            ) : totp ? (
                                <div className="space-y-8 w-full text-center">
                                    <div className="relative inline-block">
                                        <motion.div 
                                            key={totp}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-6xl font-black tracking-[0.2em] text-indigo-400 font-mono"
                                        >
                                            {totp}
                                        </motion.div>
                                    </div>

                                    <div className="flex flex-col items-center gap-4">
                                        {/* Progress Bar */}
                                        <div className="w-full max-w-[200px] h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                            <motion.div 
                                                className={`h-full ${timeLeft < 10 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, ease: "linear" }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 text-[var(--text-muted)] font-medium">
                                            <Clock className="w-4 h-4" />
                                            <span>Expires in {timeLeft}s</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCopy}
                                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                                            copied 
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                                        }`}
                                    >
                                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {copied ? 'Copied!' : 'Copy Code'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <Lock className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                                    <p className="text-[var(--text-muted)] font-medium">TOTP Secret not configured</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Please set up credentials below</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Setup Form Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-xl"
                    >
                        <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 p-6 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <Settings className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Kite Credentials</h2>
                                    <p className="text-xs text-[var(--text-muted)]">Encrypted Storage</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSetup} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-3 h-3" /> Kite Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter Kite login password"
                                    required
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                                    <Key className="w-3 h-3" /> TOTP Secret
                                </label>
                                <input
                                    type="text"
                                    value={totpSecret}
                                    onChange={(e) => setTotpSecret(e.target.value)}
                                    placeholder="Enter Base32 Secret Key"
                                    required
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={setupLoading}
                                    className="w-full py-3 bg-[var(--bg-tertiary)] hover:bg-emerald-600 hover:text-white border border-[var(--border-color)] rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {setupLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Update Credentials
                                </button>
                            </div>

                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <div className="flex gap-3">
                                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                        These credentials are used for <strong className="text-blue-400">automated morning login</strong>. 
                                        They are encrypted using AES-256-GCM before being stored in the database.
                                    </p>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>

                {/* Status Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-6 shadow-lg"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-indigo-400" /> Auto-Login Status
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Current configuration for background tasks</p>
                        </div>
                        <div className="flex gap-3">
                            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${
                                autoLoginStatus?.configured 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            }`}>
                                <div className={`w-2 h-2 rounded-full ${autoLoginStatus?.configured ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                                <span className="text-xs font-bold uppercase tracking-widest">
                                    {autoLoginStatus?.configured ? 'Configured' : 'Not Configured'}
                                </span>
                            </div>
                            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${
                                autoLoginStatus?.enabled 
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                                <span className="text-xs font-bold uppercase tracking-widest">
                                    {autoLoginStatus?.enabled ? 'Auto-Login Enabled' : 'Auto-Login Disabled'}
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AdminTOTP;
