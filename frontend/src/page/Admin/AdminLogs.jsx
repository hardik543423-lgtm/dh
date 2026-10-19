import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Terminal, Trash2, Pause, Play, Download, Search, 
  AlertCircle, Info, AlertTriangle, LogOut, ChevronDown, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

const AdminLogs = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    
    const logsEndRef = useRef(null);
    const socketRef = useRef(null);
    const apiBase = useMemo(() => import.meta.env.VITE_REACT_APP_API_URL || '', []);

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

    // Socket Connection
    useEffect(() => {
        const socketUrl = `${apiBase}/admin`;
        
        const socket = io(socketUrl, {
            path: '/socket.io',
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to Admin Socket');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('log_update', (log) => {
            if (!isPaused) {
                setLogs(prev => {
                    const newLogs = [...prev, log];
                    // Keep only last 1000 logs to prevent memory leak
                    return newLogs.length > 1000 ? newLogs.slice(newLogs.length - 1000) : newLogs;
                });
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [apiBase, token, isPaused]);

    // Auto-scroll logic
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = filter === 'all' || log.level === filter;
            const matchesSearch = !searchQuery || 
                log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.level.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [logs, filter, searchQuery]);

    const handleClear = () => setLogs([]);
    
    const handleDownload = () => {
        const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backend-logs-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleTestLog = async () => {
        try {
            await fetch(`${apiBase}/api/kite/test-log`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to trigger test log');
        }
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

    const getLevelColor = (level) => {
        switch(level) {
            case 'error': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'warn': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'info': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getLevelIcon = (level) => {
        switch(level) {
            case 'error': return <AlertCircle className="w-3.5 h-3.5" />;
            case 'warn': return <AlertTriangle className="w-3.5 h-3.5" />;
            case 'info': return <Info className="w-3.5 h-3.5" />;
            default: return <Terminal className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Terminal className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                            System Logs
                        </h1>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                            {isConnected ? 'Live' : 'Disconnected'}
                        </div>
                    </div>
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

            {/* Toolbar */}
            <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    {['all', 'info', 'warn', 'error'].map(l => (
                        <button
                            key={l}
                            onClick={() => setFilter(l)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
                                filter === l 
                                ? 'bg-indigo-600 text-white border-indigo-500' 
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-indigo-500/50'
                            }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 border-l border-[var(--border-color)] pl-4">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-yellow-500/20 text-yellow-500' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'}`}
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Clear Logs"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                        title="Download Logs"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleTestLog}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-all"
                        title="Send Test Log"
                    >
                        Send Test Log
                    </button>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors border ${autoScroll ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30' : 'text-[var(--text-muted)] border-[var(--border-color)]'}`}
                    >
                        Auto-scroll
                    </button>
                </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-auto bg-[#0a0a0c] p-4 font-mono text-sm selection:bg-indigo-500/30">
                <div className="max-w-full">
                    {filteredLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30 py-20">
                            <Terminal className="w-16 h-16 mb-4" />
                            <p>No logs to display</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((log, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-start gap-4 hover:bg-white/5 py-0.5 px-2 rounded group"
                                >
                                    <span className="text-gray-600 shrink-0 select-none text-[11px] mt-0.5">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 flex items-center gap-1.5 ${getLevelColor(log.level)}`}>
                                        {getLevelIcon(log.level)}
                                        {log.level}
                                    </span>
                                    <span className="text-gray-300 break-all whitespace-pre-wrap leading-relaxed">
                                        {log.message}
                                    </span>
                                </motion.div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <div className="px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex justify-between items-center text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                <div className="flex gap-4">
                    <span>Total Logs: {logs.length}</span>
                    <span>Filtered: {filteredLogs.length}</span>
                </div>
                <div>
                    {isPaused ? '⏸️ Paused' : '⚡ Streaming'}
                </div>
            </div>
        </div>
    );
};

export default AdminLogs;
