import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, TrendingDown, TrendingUp, ArrowLeft } from 'lucide-react';
import { logMarketStatus } from '../../../Utils/marketStatus.js'
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { useMarketData } from '../../../contexts/MarketDataContext';
import { formatTradingSymbol } from '../../../Utils/calculateBrokerage.jsx';
import LockedButtonWrapper from '../../../components/LockedButtonWrapper';

const OptionStrikeBottomWindow = ({
    isOpen,
    onClose,
    optionType,          // 'CE' | 'PE'
    strikePrice,         // Number
    instrumentToken,     // String (instrument token)
    underlyingStock,     // Object (Parent Info)
    spotPrice,           // Number
    expiry,              // String
    tradingSymbol,       // String (optional, exact symbol from backend)
    segment,             // String (optional, exact segment from backend)
    lot_size_prop,       // NUMBER (optional, passed from strike)
    brokerId,
    customerId,
    initialActionTab = 'Buy',
}) => {
    // --- Market Data Context ---
    const { subscribe, unsubscribe, ticksRef } = useMarketData();

    // --- Local States ---
    const [actionTab, setActionTab] = useState(initialActionTab || 'Buy');
    const [productType, setProductType] = useState('Intraday');
    const [localLotsStr, setLocalLotsStr] = useState('1');
    const [jobbin_price, setJobbin_price] = useState("0.08");
    const [jobbin_type, setJobbin_type] = useState("percentage"); // "percentage" or "points"
    const [advancedRanges, setAdvancedRanges] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [dataUpdateTrigger, setDataUpdateTrigger] = useState(0); // To trigger re-renders on data updates
    const inputRef = useRef(null);

    // --- Context & Role ---
    const isMarketOpen = logMarketStatus(underlyingStock?.segment);
    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;

    // Get live data from ticksRef
    const liveData = useMemo(() => {
        if (!instrumentToken || !ticksRef.current) return null;
        return ticksRef.current.get(String(instrumentToken)) || null;
    }, [instrumentToken, ticksRef, dataUpdateTrigger]);

    // Get live data from ticksRef (full data when window is open)
    const liveDataFull = useMemo(() => {
        if (!instrumentToken || !ticksRef.current) return null;
        return ticksRef.current.get(String(instrumentToken)) || null;
    }, [instrumentToken, ticksRef, dataUpdateTrigger]);

    // --- Derived Values ---
    const ltp = liveDataFull?.ltp || liveData?.ltp || 0;
    const bestBid = liveDataFull?.bestBidPrice || liveData?.bestBidPrice || 0;
    const bestAsk = liveDataFull?.bestAskPrice || liveData?.bestAskPrice || 0;

    // Lot Size
    const lotSize = lot_size_prop || underlyingStock?.lot_size || underlyingStock?.lotSize || 50;

    // Reset on Open + Fetch jobbing from DB
    useEffect(() => {
        if (isOpen) {
            setLocalLotsStr('1');
            setFeedback(null);
            setActionTab(initialActionTab || 'Buy');
            setProductType('Intraday');
            // Fetch jobbing from DB for this customer
            const fetchJobbing = async () => {
                try {
                    const activeContextString = localStorage.getItem('activeContext');
                    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
                    const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
                    const urlParams = new URLSearchParams(window.location.search);
                    const urlCustomerId = urlParams.get('customerId');
                    const userString = localStorage.getItem('loggedInUser');
                    const userObject = userString ? JSON.parse(userString) : {};

                    const effectiveBrokerId = userObject.role === 'customer'
                        ? globalBrokerId
                        : (brokerId || activeContext.brokerId || globalBrokerId);
                    const effectiveCustomerId = userObject.role === 'customer'
                        ? userObject.id
                        : (customerId || activeContext.customerId || urlCustomerId);

                    if (!effectiveBrokerId || !effectiveCustomerId) return;

                    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || '';
                    const res = await fetch(`${apiBase}/api/funds/getCustomerJobbing?broker_id_str=${effectiveBrokerId}&customer_id_str=${effectiveCustomerId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.jobbing) {
                            setJobbin_price(String(data.jobbing.price ?? 0.08));
                            setJobbin_type(data.jobbing.type || 'percentage');
                        }
                    }

                    // Fetch advanced jobbing
                    const resAdv = await fetch(`${apiBase}/api/advanced-jobbing?broker_id_str=${effectiveBrokerId}&customer_id_str=${effectiveCustomerId}`);
                    if (resAdv.ok) {
                        const dataAdv = await resAdv.json();
                        if (dataAdv.success) {
                            setAdvancedRanges(dataAdv.ranges || []);
                        }
                    }
                } catch (err) {
                    console.error('[OptionStrike] Failed to fetch jobbing from DB:', err);
                }
            };
            fetchJobbing();

            const handleJobbingUpdate = (e) => {
                try {
                    const payload = e.detail;
                    if (payload.customer_id === customerId) {
                        if (payload.jobbing) {
                            setJobbin_price(String(payload.jobbing.price ?? 0.08));
                            setJobbin_type(payload.jobbing.type || 'percentage');
                        }
                    }
                } catch (err) { }
            };

            window.addEventListener('customer_jobbing_updated', handleJobbingUpdate);
            return () => window.removeEventListener('customer_jobbing_updated', handleJobbingUpdate);
        }
    }, [isOpen, strikePrice, optionType, brokerId, customerId]);

    // Subscribe to full market data when window opens
    useEffect(() => {
        if (isOpen && instrumentToken) {
            // Subscribe to full market data for this instrument
            subscribe([{ instrument_token: instrumentToken }], 'full');
        }

        // Unsubscribe when window closes
        return () => {
            if (instrumentToken) {
                unsubscribe([{ instrument_token: instrumentToken }], 'full');
            }
        };
    }, [isOpen, instrumentToken, subscribe, unsubscribe]);

    // Trigger re-renders when tick data updates
    useEffect(() => {
        let interval;
        if (isOpen) {
            // When window is open, check for updates more frequently
            interval = setInterval(() => {
                setDataUpdateTrigger(prev => prev + 1);
            }, 100); // Update every 100ms for smooth UI updates
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOpen]);

    // --- Calculations ---
    const lotsNum = useMemo(() => {
        const n = Number(localLotsStr);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }, [localLotsStr]);

    const qtyNum = useMemo(() => {
        return lotsNum * lotSize;
    }, [lotsNum, lotSize]);

    const activeJobbing = useMemo(() => {
        const ltpVal = ltp || 0;
        const match = advancedRanges.find(r => ltpVal >= r.start_range && ltpVal <= r.end_range);
        if (match) {
            return {
                price: String(match.jobbing_value),
                type: match.jobbing_type
            };
        }
        return {
            price: jobbin_price,
            type: jobbin_type
        };
    }, [ltp, advancedRanges, jobbin_price, jobbin_type]);

    const isRangeMatched = useMemo(() => {
        const ltpVal = ltp || 0;
        return advancedRanges.some(r => ltpVal >= r.start_range && ltpVal <= r.end_range);
    }, [ltp, advancedRanges]);

    const jobbinPct = useMemo(() => {
        if (activeJobbing.type === 'points') return 0;
        const v = parseFloat(String(activeJobbing.price).trim());
        return Number.isFinite(v) ? v / 100 : 0;
    }, [activeJobbing]);

    const jobbinPoints = useMemo(() => {
        if (activeJobbing.type !== 'points') return 0;
        const v = parseFloat(String(activeJobbing.price).trim());
        return Number.isFinite(v) ? v : 0;
    }, [activeJobbing]);

    const { adjustedPricePerShare } = useMemo(() => {
        if (!ltp) return { adjustedPricePerShare: 0 };
        let pxRaw;
        if (activeJobbing.type === 'points') {
            pxRaw = actionTab === 'Buy' ? (ltp + jobbinPoints) : (ltp - jobbinPoints);
        } else {
            const perShareFactor = actionTab === 'Buy' ? (1 + jobbinPct) : (1 - jobbinPct);
            pxRaw = ltp * perShareFactor;
        }
        return { adjustedPricePerShare: Number(pxRaw.toFixed(4)) };
    }, [ltp, actionTab, jobbinPct, jobbinPoints, activeJobbing.type]);

    const totalOrderValue = useMemo(() => {
        if (!adjustedPricePerShare || !qtyNum) return 0;
        return Number((adjustedPricePerShare * qtyNum).toFixed(2));
    }, [adjustedPricePerShare, qtyNum]);

    if (!isOpen) return null;

    // --- Name Construction ---
    const getInstrumentName = () => {
        // If we have an exact tradingSymbol passed from props (e.g. from OptionChain), use it!
        if (tradingSymbol) return tradingSymbol.toUpperCase();

        let symbol = underlyingStock?.underlying_symbol
            || underlyingStock?.symbol_name
            || underlyingStock?.name
            || underlyingStock?.symbol
            || "UNKNOWN";
        
        // CLEANUP: If symbol contains " FUT", " FUTURE", or specific dates, it's likely a future's full name.
        // We only want the base part (e.g. NIFTY)
        symbol = symbol.split(' ')[0]; // Take first word, e.g. "NIFTY" from "NIFTY 25 APR FUT"
        symbol = symbol.replace(/FUT.*/i, '').replace(/FUTURE.*/i, ''); // Remove FUT/FUTURE if still there

        let expiryStr = "";
        if (expiry) {
            try {
                const d = new Date(expiry);
                const day = String(d.getDate()).padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
                const year = String(d.getFullYear()).slice(-2);
                expiryStr = `${day}${month}${year}`; // Matches TATACONSUM26APR24
            } catch (e) { }
        }
        const typeStr = (optionType === 'CE' || optionType === 'CALL') ? 'CE' : 'PE';
        return `${symbol}${expiryStr}${strikePrice}${typeStr}`.toUpperCase();
    };
    const instrumentName = formatTradingSymbol(getInstrumentName());

    const formatExpiryFull = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return dateStr; }
    };

    const handleInputChange = (e) => {
        setLocalLotsStr(e.target.value);
        setFeedback(null);
    };

    // --- CONFIRM ORDER HANDLER ---
    const handleConfirm = async () => {
        setSubmitting(true);
        setFeedback(null);

        const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

        try {
            if (!lotsNum || lotsNum < 1) {
                setFeedback({ type: 'error', message: 'Please enter a valid lot count.' });
                setSubmitting(false);
                return;
            }

            let finalInstrumentToken = String(instrumentToken || '');

            if (!finalInstrumentToken && strikePrice && optionType && expiry) {
                try {
                    const underlyingSymbol = underlyingStock?.underlying_symbol || underlyingStock?.symbol_name || underlyingStock?.name || '';
                    const lookupParams = new URLSearchParams({
                        name: underlyingSymbol,
                        strike: strikePrice,
                        optionType: optionType === 'CE' || optionType === 'CALL' ? 'CE' : 'PE',
                        expiry: expiry
                    });
                    const lookupRes = await fetch(`${apiBase}/api/option-chain/security-id?${lookupParams.toString()}`);
                    if (lookupRes.ok) {
                        const lookupData = await lookupRes.json();
                        if (lookupData.data?.instrument_token) {
                            finalInstrumentToken = String(lookupData.data.instrument_token);
                        }
                    }
                } catch (lookupErr) { }
            }

            if (!finalInstrumentToken) {
                finalInstrumentToken = String(underlyingStock?.instrument_token || '');
            }

            if (!finalInstrumentToken) {
                setFeedback({ type: 'error', message: "Instrument token missing." });
                setSubmitting(false);
                return;
            }

            // Fund Validation
            try {
                const fundsData = await getFundsData();
                if (!fundsData) throw new Error("Unable to fetch balance.");
                const requiredAmount = Number(totalOrderValue);
                let availableLimit = 0;
                if (productType === 'Intraday') {
                    availableLimit = (fundsData.intraday?.available_limit || 0) - (fundsData.intraday?.used_limit || 0);
                } else {
                    availableLimit = (fundsData.overnight?.available_limit || 0) - (fundsData.overnight?.used_limit || 0);
                }
                if (requiredAmount > availableLimit) {
                    setFeedback({ type: 'error', message: `Insufficient Funds! Required: ₹${requiredAmount}, Available: ₹${availableLimit.toFixed(2)}.` });
                    setSubmitting(false);
                    return;
                }
            } catch (fundErr) {
                setFeedback({ type: 'error', message: "Fund validation failed." });
                setSubmitting(false);
                return;
            }

            const activeContextString = localStorage.getItem('activeContext');
            const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
            const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
            const urlParams = new URLSearchParams(window.location.search);
            const urlCustomerId = urlParams.get('customerId');
            const userString = localStorage.getItem('loggedInUser');
            const userObject = userString ? JSON.parse(userString) : {};

            const effectiveBrokerId = userObject.role === 'customer'
                ? globalBrokerId
                : (brokerId || activeContext.brokerId || globalBrokerId);
            const effectiveCustomerId = userObject.role === 'customer'
                ? userObject.id
                : (customerId || activeContext.customerId || urlCustomerId);

            const side = actionTab === 'Buy' ? 'BUY' : 'SELL';
            const product = productType === 'Intraday' ? 'MIS' : 'NRML';

            // Dynamically calculate matching jobbing price & type for the fresh order price!
            const orderMatch = advancedRanges.find(r => ltp >= r.start_range && ltp <= r.end_range);
            const orderJobbingPrice = orderMatch ? String(orderMatch.jobbing_value) : jobbin_price;
            const orderJobbingType = orderMatch ? orderMatch.jobbing_type : jobbin_type;
            const orderJobbingPct = orderJobbingType === 'percentage' ? (parseFloat(orderJobbingPrice) || 0) / 100 : 0;
            const orderJobbingPoints = orderJobbingType === 'points' ? (parseFloat(orderJobbingPrice) || 0) : 0;

            let finalPrice;
            if (orderJobbingType === 'points') {
                finalPrice = Number((actionTab === 'Buy' ? (ltp + orderJobbingPoints) : (ltp - orderJobbingPoints)).toFixed(4));
            } else {
                const jobbinFactor = actionTab === 'Buy' ? (1 + orderJobbingPct) : (1 - orderJobbingPct);
                finalPrice = Number((ltp * jobbinFactor).toFixed(4));
            }
            if (finalPrice <= 0) {
                setFeedback({ type: 'error', message: 'Price / Share cannot be zero or negative. Please adjust your jobbing point.' });
                setSubmitting(false);
                return;
            }
            const token = localStorage.getItem('token') || localStorage.getItem('authToken') || null;

            // Normalize Segment for Options
            const getNormalizedSegment = () => {
                if (segment) return segment; // Use passed segment if available
                
                const baseSegment = underlyingStock?.segment || 'NFO-OPT';
                // Always force OPT segment since this window is for options
                return baseSegment.replace('-FUT', '-OPT');
            };

            // Construct a pseudo stock object for the option contract.
            // Many order listing components fall back to meta.selectedStock.tradingSymbol for rendering.
            const pseudoSelectedStock = {
                ...underlyingStock,
                tradingSymbol: instrumentName,
                name: instrumentName,
                segment: getNormalizedSegment(),
                instrument_token: finalInstrumentToken,
                instrument_type: optionType === 'CE' || optionType === 'CALL' ? 'CE' : 'PE',
                strike: strikePrice,
                expiry: expiry
            };

            const payload = {
                broker_id_str: effectiveBrokerId,
                customer_id_str: effectiveCustomerId,
                instrument_token: finalInstrumentToken,
                symbol: instrumentName,
                segment: getNormalizedSegment(),
                side,
                product,
                price: Number(finalPrice),
                quantity: qtyNum,
                lots: lotsNum,
                lot_size: lotSize,
                jobbin_price: (orderJobbingPrice === '' || orderJobbingPrice === undefined || orderJobbingPrice === null) ? 0 : Number(orderJobbingPrice),
                jobbin_type: orderJobbingType,
                came_From: 'Open',
                expire: expiry || undefined,
                meta: { from: 'ui_option_chain', underlying: underlyingStock?.name, expiry, strike: strikePrice, optionType, selectedStock: pseudoSelectedStock },
                placed_at: new Date()
            };

            const res = await fetch(`${apiBase}/api/orders/postOrder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            let body = await res.json();
            if (!res.ok || body.success === false) {
                // Backend returns errors in different formats
                const errMsg = body.message || body.error || (body.details ? body.details.map(d => d.message).join(', ') : 'Order failed');
                throw new Error(errMsg);
            }

            setFeedback({ type: 'success', message: 'Order placed successfully!' });
            setTimeout(() => onClose(), 1500);

        } catch (err) {
            setFeedback({ type: 'error', message: `Order failed: ${String(err.message)}` });
        } finally {
            setSubmitting(false);
        }
    };

    const changePercent = liveDataFull?.percentChange || 0;
    const isPositive = changePercent >= 0;

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-end justify-center sm:items-center backdrop-blur-sm">
            <div className="bg-[#131722] w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl relative overflow-hidden animate-slide-up ring-1 ring-white/5 font-sans text-[#b2b5be]">
                
                {/* MATCHED HEADER: Back Button and Title */}
                <div className="flex justify-between items-center p-4 border-b border-[#2a2e39] bg-[#1e222d]">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button onClick={onClose} className="p-1 -ml-1 rounded-full hover:bg-[#2a2e39] text-[#808a9d] hover:text-white transition flex-shrink-0">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-white font-bold text-base sm:text-lg truncate tracking-tight">{instrumentName}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[#2a2e39] text-[#808a9d] hover:text-white transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-grow overflow-y-auto w-full">
                    
                    {/* MATCHED MINI HEADER: Price Section */}
                    <div className="px-4 py-4 bg-[#1e222d]/30 flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                            <p className="text-2xl font-black text-white">₹{ltp ? ltp.toFixed(2) : '—'}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? "bg-[#089981]/20 text-[#089981]" : "bg-[#f23645]/20 text-[#f23645]"}`}>
                                {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                            </span>
                        </div>
                        <p className="text-[9px] font-bold text-[#808a9d] uppercase tracking-tighter opacity-40">Live Price</p>
                    </div>

                    {/* MATCHED COMPACT TOGGLES: Buy/Sell */}
                    <div className="flex gap-2 px-4 mb-3 mt-4">
                        <button
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all ${actionTab === 'Buy' ? 'border-[#4f46e5] bg-[#4f46e5]/10 text-[#a5b4fc]' : 'border-[#2a2e39] text-[#808a9d] bg-[#1e222d]'}`}
                            onClick={() => setActionTab('Buy')}
                        >BUY</button>
                        {userRole !== 'customer' && (
                            <button
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all ${actionTab === 'Sell' ? 'border-[#f23645] bg-[#f23645]/10 text-[#fca5a5]' : 'border-[#2a2e39] text-[#808a9d] bg-[#1e222d]'}`}
                                onClick={() => setActionTab('Sell')}
                            >SELL</button>
                        )}
                    </div>

                    {/* MATCHED PRODUCT TYPE TOGGLES */}
                    <div className="px-4 mb-4">
                        <div className="flex bg-[#1e222d] rounded-xl p-1 border border-[#2a2e39]">
                            <button 
                                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productType === 'Intraday' ? 'bg-[#2a2e39] text-white shadow-lg' : 'text-[#808a9d]'}`} 
                                onClick={() => setProductType('Intraday')}
                            >INTRADAY</button>
                            <button 
                                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productType === 'Overnight' ? 'bg-[#2a2e39] text-white shadow-lg' : 'text-[#808a9d]'}`} 
                                onClick={() => setProductType('Overnight')}
                            >OVERNIGHT</button>
                        </div>
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div className="px-4 mb-3">
                            <div className={`p-2 rounded-lg text-[11px] font-bold text-center ${feedback.type === 'error' ? 'bg-[#f23645]/10 text-[#fca5a5]' : 'bg-[#089981]/10 text-[#a5f3e0]'}`}>
                                {feedback.message}
                            </div>
                        </div>
                    )}

                    {/* MATCHED COMPACT QUANTITY CARD */}
                    <div className="px-4 pb-4">
                        <div className="mb-3 bg-[#1e222d] p-4 rounded-2xl border border-[#2a2e39] relative">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[9px] font-black text-[#808a9d] uppercase tracking-wider">Qty (Lots)</span>
                                <span className="text-[8px] font-bold text-white/30 bg-white/5 px-1.5 py-0.2 rounded-full">Lot: {lotSize}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    onClick={() => { setLocalLotsStr(String(Math.max(0, (Number(localLotsStr) || 0) - 1))); setFeedback(null); }}
                                    className="w-10 h-10 rounded-xl bg-[#2a2e39] border border-[#363a45] text-white flex items-center justify-center shadow-sm active:scale-90"
                                ><TrendingDown size={16} /></button>
                                <div className="flex-1 flex flex-col items-center">
                                    <input
                                        ref={inputRef}
                                        type="number"
                                        value={localLotsStr}
                                        onChange={handleInputChange}
                                        className="bg-transparent text-center text-4xl font-black text-white w-full outline-none"
                                        placeholder="0"
                                    />
                                    <span className="text-[8px] font-bold text-[#808a9d] mt-1 uppercase">Total: {qtyNum}</span>
                                </div>
                                <button
                                    onClick={() => { setLocalLotsStr(String((Number(localLotsStr) || 0) + 1)); setFeedback(null); }}
                                    className="w-10 h-10 rounded-xl bg-[#2a2e39] border border-[#363a45] text-white flex items-center justify-center shadow-sm active:scale-90"
                                ><TrendingUp size={16} /></button>
                            </div>
                        </div>

                        {/* MATCHED COMPACT JOBBING (Broker Only) */}
                        {userRole === 'broker' && (
                            <div className="mb-3 bg-[#1e222d] p-3.5 rounded-2xl border border-[#2a2e39]">
                                <label className="text-[9px] font-black text-[#808a9d] uppercase mb-1 block">
                                    Jobbing ({activeJobbing.type === 'percentage' ? '%' : '₹'}) {isRangeMatched && <span className="text-[8px] text-indigo-400 font-bold ml-1.5 uppercase">(Range Active)</span>}
                                </label>
                                <input 
                                    type="number" 
                                    value={activeJobbing.price} 
                                    onChange={(e) => !isRangeMatched && setJobbin_price(e.target.value)} 
                                    disabled={isRangeMatched}
                                    className={`bg-transparent text-center text-2xl font-black w-full outline-none ${isRangeMatched ? 'text-indigo-400 opacity-90' : 'text-white'}`} 
                                />
                            </div>
                        )}

                        {/* MATCHED VALUE DASHBOARD */}
                        <div className="p-4 bg-[#1e222d]/40 rounded-2xl border border-[#2a2e39]">
                            <div className="flex flex-col gap-2">
                                {userRole === 'broker' && (
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase text-[#808a9d]">
                                        <span>Price / Share</span>
                                        <span className="text-white">₹{adjustedPricePerShare.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-[10px] font-black uppercase border-t border-[#2a2e39] pt-2">
                                    <span className="text-[#808a9d]">Total Value</span>
                                    <span className="text-white text-lg">₹{totalOrderValue.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MATCHED MINI FOOTER */}
                <div className="p-4 bg-[#1e222d] border-t border-[#2a2e39] flex gap-3">
                    {(userRole === 'broker' || isMarketOpen) && (
                        <LockedButtonWrapper featureId={actionTab === 'Buy' ? 'buy' : 'sell'} className="flex-[2]">
                            <button 
                                onClick={handleConfirm} 
                                disabled={submitting || !lotsNum || adjustedPricePerShare <= 0} 
                                className={`w-full py-3.5 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 ${actionTab === 'Buy' ? 'bg-[#089981]' : 'bg-[#f23645]'} ${submitting || !lotsNum || adjustedPricePerShare <= 0 ? 'opacity-50' : ''}`}
                            >
                                {submitting ? '...' : actionTab}
                            </button>
                        </LockedButtonWrapper>
                    )}
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3.5 rounded-xl bg-[#2a2e39] text-[#808a9d] font-bold text-[10px] uppercase transition-colors hover:text-white"
                    >Close</button>
                </div>
            </div>
            <style>{`
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
};

export default OptionStrikeBottomWindow;