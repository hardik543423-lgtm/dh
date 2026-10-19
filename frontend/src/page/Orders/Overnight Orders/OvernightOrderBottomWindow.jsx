import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Target, AlertCircle } from 'lucide-react';
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { logMarketStatus } from '../../../Utils/marketStatus.js';
import { calculatePnLAndBrokerage, formatTradingSymbol } from '../../../Utils/calculateBrokerage.jsx';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// sirf ENTRY side pe 0.01%
const ENTRY_BROKERAGE_PERCENT = 0.01;

const DetailRow = ({ Icon, label, value, colorClass }) => {
    return (
        <div className="flex justify-between items-center py-0.5 px-2">
            <div className="flex items-center text-[var(--text-secondary)]">
                {Icon && <Icon className="w-3 h-3 mr-2" />}
                <span className="text-xs">{label}</span>
            </div>
            <span className={`text-sm font-medium ${colorClass || "text-[var(--text-primary)]"}`}>
                {value}
            </span>
        </div>
    );
};

export default function OvernightOrderBottomWindow({ selectedOrder, onClose, sheetData }) {
    if (!selectedOrder) return null;
    const isOpen = logMarketStatus();

    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;

    // Fix: Read from DB field 'expire', with fallback to meta fields
    const expireDate = selectedOrder.expire
        || selectedOrder.meta?.expiry
        || selectedOrder.meta?.selectedStock?.expiry;
    const expireDateTime = expireDate ? new Date(expireDate) : null;
    const formattedStockExpireDate = expireDateTime && !isNaN(expireDateTime)
        ? `${String(expireDateTime.getDate()).padStart(2, '0')}-${String(expireDateTime.getMonth() + 1).padStart(2, '0')}-${expireDateTime.getFullYear()}`
        : 'N/A';

    // Order placed date
    const placedDate = selectedOrder.placed_at || selectedOrder.createdAt;
    const formattedPlacedDate = placedDate ? (() => {
        const d = new Date(placedDate);
        return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear()
            + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    })() : 'N/A';

    const {
        symbol, side, product, quantity: initialQty, price: initialPrice, jobbin_price,
        instrument_token, segment, _id: orderId, lots, stop_loss, target
    } = selectedOrder;

    const lotSize = Number(selectedOrder.lot_size) || Number(selectedOrder.meta?.selectedStock?.lot_size) || 1;

    const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
    const currentPrice = ltpRaw || Number(initialPrice) || 0;
    const formattedCMP = currentPrice ? `₹${currentPrice.toFixed(2)}` : '—';

    // States
    const [addLotInput, setAddLotInput] = useState('');
    const [slPrice, setSlPrice] = useState(selectedOrder.stop_loss || '');
    const [targetPrice, setTargetPrice] = useState(selectedOrder.target || '');

    const [submitting, setSubmitting] = useState(false);
    const [action, setAction] = useState('Adjust');
    const [feedback, setFeedback] = useState(null);
    const [orderStatus, setOrderStatus] = useState((selectedOrder.order_status || 'OPEN').toUpperCase());

    // --- Jobbing Point State ---
    const [jobbingPointInput, setJobbingPointInput] = useState(selectedOrder.jobbing_point || '');
    const [savedJobbingPoint, setSavedJobbingPoint] = useState(selectedOrder.jobbing_point || 0);
    const [jobbingAppliedLtpState, setJobbingAppliedLtpState] = useState(selectedOrder.jobbing_applied_ltp || 0);
    const [customerExitPriceInput, setCustomerExitPriceInput] = useState(selectedOrder.customer_exit_price || '');
    const [savedCustomerExitPrice, setSavedCustomerExitPrice] = useState(selectedOrder.customer_exit_price || 0);
    const [savingJP, setSavingJP] = useState(false);
    const [savingCEP, setSavingCEP] = useState(false);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || null;
    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    useEffect(() => {
        setAddLotInput('');
        setSlPrice(selectedOrder.stop_loss || '');
        setTargetPrice(selectedOrder.target || '');
        
        // Initial set from prop
        setJobbingPointInput(selectedOrder.jobbing_point || '');
        setSavedJobbingPoint(selectedOrder.jobbing_point || 0);
        setJobbingAppliedLtpState(selectedOrder.jobbing_applied_ltp || 0);
        setCustomerExitPriceInput(selectedOrder.customer_exit_price || '');
        setSavedCustomerExitPrice(selectedOrder.customer_exit_price || 0);

        setFeedback(null);
        setAction('Adjust');
        setOrderStatus((selectedOrder.order_status || 'OPEN').toUpperCase());

        // --- FETCH FRESH DATA FROM DB ---
        const fetchFreshData = async () => {
            try {
                const url = `${apiBase.replace(/\/$/, "")}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&id=${selectedOrder._id}`;
                const res = await fetch(url, {
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
                });
                if (res.ok) {
                    const data = await res.json();
                    const freshOrder = data?.ordersInstrument?.[0];
                    if (freshOrder) {
                        setJobbingPointInput(freshOrder.jobbing_point || '');
                        setSavedJobbingPoint(freshOrder.jobbing_point || 0);
                        setJobbingAppliedLtpState(freshOrder.jobbing_applied_ltp || 0);
                        setCustomerExitPriceInput(freshOrder.customer_exit_price || '');
                        setSavedCustomerExitPrice(freshOrder.customer_exit_price || 0);
                        setSlPrice(freshOrder.stop_loss || '');
                        setTargetPrice(freshOrder.target || '');
                    }
                }
            } catch (err) { console.error("Error fetching fresh order data:", err); }
        };
        if (selectedOrder?._id) fetchFreshData();
    }, [selectedOrder, brokerId, customerId, apiBase, token]);

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';

    const avg = Number(selectedOrder.average_price ?? initialPrice ?? 0);
    const ltpRawValue = Number(sheetData?.ltp ?? initialPrice ?? 0);
    let displayLtp = ltpRawValue;

    // Apply BOTH entry-side (%) and manual (₹) jobbing to display LTP
    const jRaw = Number(selectedOrder.increase_price || 0);
    const jType = selectedOrder.jobbin_type || 'percentage';
    const jPnt = Number(selectedOrder.jobbing_point || 0);

    const isBuy = orderSide === 'BUY';
    const adjustActionColor = 'bg-indigo-600';

    if (displayLtp > 0) {
        // (Jobbing Point applied ONLY upon execution of Exit, not on Display)
    }
    const ltp = displayLtp;
    const qty = Number(initialQty ?? 0);

    // ---------- BROKERAGE + P&L (ENTRY SIDE ONLY) ----------
    const {
        entryValue,
        currentValue,
        brokerageEntry,
        totalBrokerage,
        grossPnl,
        netPnl,
        pct,
    } = calculatePnLAndBrokerage({
        side: orderSide,
        avgPrice: avg,
        ltp,
        qty,
        brokeragePercentPerSide: ENTRY_BROKERAGE_PERCENT,
        mode: "entry-only",
        symbol: tradingsymbol,
    });

    const pnlColor = netPnl >= 0 ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
    const pnlChipBg = netPnl >= 0 ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";

    // --- ADD LOT CALCULATION ---
    const currentLots = Number(lots ?? 0);
    const parsedAddLots = Math.max(0, parseInt(String(addLotInput).trim() || '0', 10));
    const targetTotalLots = currentLots + parsedAddLots;
    const targetTotalQuantity = targetTotalLots * lotSize;

    // Weighted Avg Price Logic (Apply order's original jobbing to new lots)
    let computedAvg = avg || 0;
    let jobbingAdjustedNewPrice = currentPrice; // default: raw LTP
    if (parsedAddLots > 0) {
        const orderJobbing = Number(selectedOrder.increase_price || 0);
        const orderJobbinType = selectedOrder.jobbin_type || 'percentage';
        const orderSideIsBuy = orderSide === 'BUY';

        if (orderJobbing > 0 && currentPrice > 0) {
            if (orderJobbinType === 'points') {
                jobbingAdjustedNewPrice = orderSideIsBuy
                    ? currentPrice - orderJobbing
                    : currentPrice + orderJobbing;
            } else {
                const factor = orderSideIsBuy
                    ? (1 - orderJobbing / 100)
                    : (1 + orderJobbing / 100);
                jobbingAdjustedNewPrice = currentPrice * factor;
            }
        }

        const totalExisting = avg * qty;
        const totalNew = jobbingAdjustedNewPrice * (parsedAddLots * lotSize);
        computedAvg = (totalExisting + totalNew) / targetTotalQuantity;
    }
    const displayComputedAvg = `₹${Number(computedAvg || 0).toFixed(2)}`;

    // --- ACTION HANDLER ---
    const handleAction = async (intendedAction) => {
        setSubmitting(true);
        setFeedback(null);
        setAction(intendedAction);

        try {
            // Validation & Fund Check
            if (intendedAction === 'Adjust') {

                const sl = Number(slPrice) || 0;
                const tgt = Number(targetPrice) || 0;

                // --- 1. STOP LOSS & TARGET VALIDATION (Real Market Rules) ---
                if (currentPrice > 0) {
                    if (orderSide === 'BUY') {
                        // [BUY RULE]: SL must be LOWER than Current Price
                        if (sl > 0 && sl >= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid SL: For BUY, SL must be lower than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                        // [BUY RULE]: Target must be HIGHER than Current Price
                        if (tgt > 0 && tgt <= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid Target: For BUY, Target must be higher than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                    } else {
                        // [SELL RULE]: SL must be HIGHER than Current Price
                        if (sl > 0 && sl <= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid SL: For SELL, SL must be higher than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                        // [SELL RULE]: Target must be LOWER than Current Price
                        if (tgt > 0 && tgt >= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid Target: For SELL, Target must be lower than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                    }
                }

                // --- 2. FUND CHECK FOR ADDING LOTS ---
                if (parsedAddLots > 0) {
                    try {
                        const fundsData = await getFundsData();
                        if (!fundsData) throw new Error("Unable to fetch wallet balance.");

                        const requiredAmount = (parsedAddLots * lotSize) * jobbingAdjustedNewPrice;
                        const availableLimit = fundsData.overnight?.available_limit || 0;

                        if (requiredAmount > availableLimit) {
                            setFeedback({
                                type: 'error',
                                message: `Insufficient Overnight Funds! Required: ₹${requiredAmount.toFixed(2)}, Available: ₹${availableLimit.toFixed(2)}`
                            });
                            setSubmitting(false);
                            return;
                        }
                    } catch (fundErr) {
                        setFeedback({ type: 'error', message: "Fund validation failed. Try again." });
                        setSubmitting(false);
                        return;
                    }
                }
            }

            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const basePayload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                instrument_token: instrument_token,
                symbol: tradingsymbol,
                side: orderSide,
                product: product,
                segment: segment,
            };

            let payload = {};

            if (intendedAction === 'Adjust') {
                // *** BUY MORE / UPDATE SL-TARGET ***
                payload = {
                    ...basePayload,
                    lots: String(targetTotalLots),
                    quantity: Number(targetTotalQuantity),
                    price: Number(Number(computedAvg).toFixed(2)),
                    order_status: null,
                    stop_loss: slPrice ? Number(slPrice) : 0,
                    target: targetPrice ? Number(targetPrice) : 0,
                    jobbing_point: jobbingPointInput ? Number(jobbingPointInput) : 0,
                    meta: { from: 'ui_overnight_order_adjustment' }
                };
            } else if (intendedAction === 'Close') {
                // *** EXIT LOGIC ***
                const liveLtp = Number(sheetData?.ltp ?? 0);
                const jobbingRaw = Number(selectedOrder.increase_price || 0);
                const jobbingType = selectedOrder.jobbin_type || 'percentage';

                let closedLtp;
                if (Number(savedCustomerExitPrice) > 0) {
                    closedLtp = Number(savedCustomerExitPrice);
                } else {
                    const refLtp = Number(jobbingAppliedLtpState || 0) || liveLtp || currentPrice || initialPrice || 0;
                    closedLtp = refLtp;

                    // (REMOVED Entry-Side Jobbing % from Exit)

                    // --- Apply Jobbing Point (separate exit-time deduction) ---
                    const jpValue = Number(savedJobbingPoint || 0);
                    if (jpValue > 0 && closedLtp > 0) {
                        if (orderSide === 'BUY') closedLtp = closedLtp - jpValue;
                        else closedLtp = closedLtp + jpValue;
                    }
                }

                payload = {
                    ...basePayload,
                    lots: String(lots),
                    quantity: Number(initialQty),
                    closed_ltp: Number(Number(closedLtp || 0).toFixed(4)),
                    closed_at: new Date().toISOString(),
                    order_status: "CLOSED",
                    came_From: 'Overnight',
                    meta: { from: 'ui_overnight_order_closure' }
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { }

            if (!res.ok || (body && body.success === false)) {
                throw new Error(body?.message || `Server error: ${res.status}`);
            }

            let successMsg = `${intendedAction} successful.`;
            if (intendedAction === 'Adjust' && parsedAddLots === 0) successMsg = "Order Updated Successfully!";

            setFeedback({ type: 'success', message: successMsg });
            try {
                window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } }));
            } catch (e) { }

            setTimeout(() => onClose(), 1000);

        } catch (err) {
            console.error("Error inside handleAction:", err);
            setFeedback({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-[60] bg-[var(--bg-primary)] text-[var(--text-secondary)] font-sans flex flex-col overflow-hidden animate-in fade-in duration-300 max-h-[90vh]">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
                <div className="flex flex-col">
                    <h3 className="text-base sm:text-lg text-[var(--text-primary)] font-black leading-tight truncate">{formatTradingSymbol(tradingsymbol)}</h3>
                    <div className="flex items-center gap-2">
                         <span className={`text-[9px] font-black uppercase px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
                                {orderSide}
                         </span>
                         <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase opacity-60">
                             {productType} • LOT SIZE: {lotSize}
                         </span>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                    <XCircle size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
                {feedback && (
                    <div className={`p-2 mb-3 rounded-lg text-xs font-bold text-center border animate-in slide-in-from-top-1 ${feedback.type === 'error' ? 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)] border-[var(--loss-chip-bg)]/20' : 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)] border-[var(--gain-chip-bg)]/20'}`}>
                        {feedback.message}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-[var(--bg-card)] px-3 py-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Live Price</p>
                        <p className="text-xl font-black text-[var(--text-primary)] leading-none">{formattedCMP}</p>
                    </div>
                    <div className="bg-[var(--bg-card)] px-3 py-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Unrealized P&L</p>
                        <p className={`text-xl font-black leading-none ${pnlColor}`}>
                            {money(netPnl)}
                        </p>
                    </div>
                </div>

                <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] space-y-1.5">
                    <DetailRow label="Quantity" value={`${initialQty} shares`} />
                    <DetailRow label="Lots" value={`${lots} lots`} />
                    <DetailRow label="Avg. Buy Price" value={money(initialPrice)} />
                    <DetailRow label="Type" value={orderSide} />
                    <DetailRow label="Order Instant" value={productType} colorClass="text-[#3b82f6]" />
                    <DetailRow label="Order Date" value={formattedPlacedDate} colorClass="text-[var(--text-muted)]" />
                    <DetailRow label="Expire Date" value={formattedStockExpireDate} colorClass="text-[var(--text-muted)]" />
                    {(stop_loss !== 0 && stop_loss != null) && <DetailRow label="Stop Loss" value={stop_loss} colorClass="text-[var(--loss-text)]" />}
                    {(target !== 0 && target != null) && <DetailRow label="Target" value={target} colorClass="text-[var(--gain-text)]" />}
                    <div className="mt-2 pt-2 border-t border-[var(--border-color)] text-right text-[10px] text-[var(--text-muted)] italic">
                        Est. Brokerage (entry): -{money(brokerageEntry)}
                    </div>
                </div>

                <div className="p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] space-y-4">
                    <div>
                         <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[2px] mb-3">Modify Order</h4>
                         
                         <div className="space-y-3">
                            <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Add Lots (+/-)</span>
                                    <span className="text-[9px] font-bold text-[#3b82f6]">Size: {lotSize}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                     <input
                                        type="number"
                                        min="0"
                                        value={addLotInput}
                                        onChange={(e) => setAddLotInput(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-2xl font-black text-[var(--text-primary)] focus:outline-none"
                                        disabled={orderStatus !== 'OPEN'}
                                    />
                                </div>
                            </div>

                            {userRole === 'broker' && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                                    <Hash className="w-4 h-4 text-[var(--text-muted)]" />
                                    <div className="flex-1 flex justify-between items-center">
                                        <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">New Weighted Avg</span>
                                        <span className="text-xs font-black text-[var(--text-primary)]">{displayComputedAvg}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="bg-[var(--bg-secondary)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                                    <span className="text-[8px] font-black text-[var(--loss-text)] uppercase mb-1 block">Stop Loss</span>
                                    <input
                                        type="number"
                                        value={slPrice}
                                        onChange={(e) => setSlPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none"
                                    />
                                </div>
                                <div className="bg-[var(--bg-secondary)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                                    <span className="text-[8px] font-black text-[var(--gain-text)] uppercase mb-1 block">Target</span>
                                    <input
                                        type="number"
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none"
                                    />
                                </div>
                            </div>

                            {userRole === 'broker' && (
                                <>
                                    <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                                    <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <div className="flex-1">
                                        <span className="text-[8px] font-black text-[var(--text-muted)] uppercase block">Jobbing Point (₹)</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={jobbingPointInput}
                                            onChange={(e) => setJobbingPointInput(e.target.value)}
                                            placeholder="0"
                                            className="bg-transparent text-lg font-black text-[var(--text-primary)] focus:outline-none w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[8px] font-black ${savedJobbingPoint > 0 ? 'text-green-400' : 'text-[var(--text-muted)]'} uppercase`}>Saved: ₹{savedJobbingPoint}</span>
                                        <button
                                            onClick={async () => {
                                                setSavingJP(true);
                                                try {
                                                    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                                        body: JSON.stringify({
                                                            order_id: selectedOrder._id,
                                                            broker_id_str: brokerId,
                                                            customer_id_str: customerId,
                                                            jobbing_point: jobbingPointInput ? Number(jobbingPointInput) : 0,
                                                            jobbing_applied_ltp: Number(currentPrice || 0),
                                                        })
                                                    });
                                                    if (res.ok) {
                                                        const jpVal = Number(jobbingPointInput) || 0;
                                                        const jpLtp = Number(currentPrice || 0);
                                                        setSavedJobbingPoint(jpVal);
                                                        setJobbingAppliedLtpState(jpLtp);
                                                        if (jpVal > 0) {
                                                            setSavedCustomerExitPrice(0);
                                                            setCustomerExitPriceInput('');
                                                        }
                                                        setFeedback({ type: 'success', message: 'Jobbing Point saved!' });
                                                        window.dispatchEvent(new CustomEvent('orders:changed', {
                                                            detail: { order: { ...selectedOrder, jobbing_point: jpVal, jobbing_applied_ltp: jpLtp, customer_exit_price: jpVal > 0 ? 0 : savedCustomerExitPrice } }
                                                        }));
                                                    } else {
                                                        setFeedback({ type: 'error', message: 'Failed to save' });
                                                    }
                                                } catch { setFeedback({ type: 'error', message: 'Network error' }); }
                                                setSavingJP(false);
                                                setTimeout(() => setFeedback(null), 2000);
                                            }}
                                            disabled={savingJP}
                                            className="px-3 py-1 bg-[var(--gain-chip-bg)] text-[var(--gain-text)] text-[10px] font-black rounded-lg hover:bg-[var(--gain-chip-bg)]/30 transition-colors uppercase tracking-tight"
                                        >
                                            {savingJP ? '...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)] mt-2">
                                    <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    <div className="flex-1">
                                        <span className="text-[8px] font-black text-[var(--text-muted)] uppercase block">Customer Exit Price (₹)</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={customerExitPriceInput}
                                            onChange={(e) => setCustomerExitPriceInput(e.target.value)}
                                            placeholder="0.00"
                                            className="bg-transparent text-lg font-black text-[var(--text-primary)] focus:outline-none w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[8px] font-black ${savedCustomerExitPrice > 0 ? 'text-green-400' : 'text-[var(--text-muted)]'} uppercase`}>Saved: ₹{savedCustomerExitPrice}</span>
                                        <button
                                            onClick={async () => {
                                                setSavingCEP(true);
                                                try {
                                                    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                                        body: JSON.stringify({
                                                            order_id: selectedOrder._id,
                                                            broker_id_str: brokerId,
                                                            customer_id_str: customerId,
                                                            customer_exit_price: customerExitPriceInput ? Number(customerExitPriceInput) : 0,
                                                        })
                                                    });
                                                    if (res.ok) {
                                                        const cepVal = Number(customerExitPriceInput) || 0;
                                                        setSavedCustomerExitPrice(cepVal);
                                                        if (cepVal > 0) {
                                                            setSavedJobbingPoint(0);
                                                            setJobbingPointInput('');
                                                            setJobbingAppliedLtpState(0);
                                                        }
                                                        setFeedback({ type: 'success', message: 'Customer Exit Price saved!' });
                                                        window.dispatchEvent(new CustomEvent('orders:changed', {
                                                            detail: { order: { ...selectedOrder, customer_exit_price: cepVal, jobbing_point: cepVal > 0 ? 0 : savedJobbingPoint, jobbing_applied_ltp: cepVal > 0 ? 0 : jobbingAppliedLtpState } }
                                                        }));
                                                    } else {
                                                        setFeedback({ type: 'error', message: 'Failed to save' });
                                                    }
                                                } catch { setFeedback({ type: 'error', message: 'Network error' }); }
                                                setSavingCEP(false);
                                                setTimeout(() => setFeedback(null), 2000);
                                            }}
                                            disabled={savingCEP}
                                            className="px-3 py-1 bg-[var(--gain-chip-bg)] text-[var(--gain-text)] text-[10px] font-black rounded-lg hover:bg-[var(--gain-chip-bg)]/30 transition-colors uppercase tracking-tight"
                                        >
                                            {savingCEP ? '...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                         </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--bg-card)] border-t border-[var(--border-color)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {(userRole === 'broker' || isOpen) && (
                    <div className="flex gap-2.5">
                        <button
                            onClick={() => handleAction('Adjust')}
                            disabled={submitting}
                            className={`flex-[1.5] py-3.5 rounded-xl text-white font-black text-[11px] uppercase tracking-widest bg-[#6366f1] shadow-lg shadow-[#6366f1]/20 ${submitting && action === 'Adjust' ? 'opacity-50' : ''}`}
                        >
                            {submitting && action === 'Adjust' ? 'UPDATING...' : (parsedAddLots > 0 ? 'BUY MORE' : 'BUY MORE')}
                        </button>

                        {userRole === 'broker' && <button
                            onClick={() => handleAction('Close')}
                            disabled={submitting}
                            className={`flex-1 py-3.5 rounded-xl text-[var(--text-primary)] font-black text-[11px] uppercase tracking-widest bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-primary)] transition-all ${submitting && action === 'Close' ? 'opacity-50' : ''}`}
                        >
                            {submitting && action === 'Close' ? 'EXITING...' : 'EXIT'}
                        </button>}
                    </div>
                )}
            </div>
        </div>
    );
}