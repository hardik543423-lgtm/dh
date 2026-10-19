import React, { useEffect, useState, useRef, useMemo } from "react";
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Clock, Layers, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { motion, useMotionValue, useTransform } from "framer-motion";
import ClosedOrderFilter from "./CloseOrderFilter";
import { logMarketStatus } from '../../../Utils/marketStatus.js';
import { calculateExitBrokerageAndPnL, formatTradingSymbol } from "../../../Utils/calculateBrokerage.jsx";
import Toast from "../../../Utils/Toast";
import { usePermissions } from '../../../contexts/PermissionsContext.jsx';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// --- Helper to ensure consistent math everywhere ---
const getOrderValues = (order) => {
    const qty = parseFloat(order.quantity) || 0;

    // Priority: average_price -> price
    let entryPrice = parseFloat(order.average_price);
    if (!entryPrice) entryPrice = parseFloat(order.price) || 0;

    // Exit: closed_ltp -> ltp
    let exitPrice = parseFloat(order.closed_ltp);
    if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;

    return { qty, entryPrice, exitPrice };
};

// --- Internal Component: DetailRow (Safe Icon Rendering) ---
const DetailRow = ({ Icon, label, value, colorClass }) => (
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

// --- Swipeable Item Component (Matches Watchlist Style) ---
const SwipeableClosedOrderItem = ({ data, onSelect, onDelete }) => {
    const x = useMotionValue(0);
    const bgOpacity = useTransform(x, [-100, 0], [1, 0]);

    const tradingsymbolRaw = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
    const tradingsymbol = String(tradingsymbolRaw ?? "");

    const { qty, entryPrice, exitPrice } = getOrderValues(data);
    const sideUpper = String(data.side ?? "").toUpperCase();
    const isBuy = sideUpper === "BUY";

    const {
        pct,
        netPnl
    } = calculateExitBrokerageAndPnL({
        side: sideUpper,
        avgPrice: entryPrice,
        exitPrice,
        qty,
        symbol: tradingsymbol
    });

    const profit = netPnl >= 0;
    const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
    const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
    const arrow = profit ? "▲" : "▼";

    const pctText = `${arrow} ${netPnl.toFixed(2)} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

    return (
        <div className="relative overflow-hidden rounded-3xl mb-4">
            {/* Background Layer (Red with Delete Icon) */}
            <motion.div
                style={{ opacity: bgOpacity }}
                className="absolute inset-y-0 right-0 w-full bg-[#f23645]/20 rounded-3xl flex items-center justify-end pr-8 z-0"
            >
                <div className="flex flex-col items-center gap-1.5 translate-x-2">
                    <Trash2 className="text-[#f23645] w-6 h-6" />
                    <span className="text-[7px] font-black text-[#f23645] uppercase tracking-widest">Delete</span>
                </div>
            </motion.div>

            {/* Foreground Layer (The Actual Item) */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                onDragEnd={(e, { offset }) => {
                    if (offset.x < -100) {
                        onDelete(data._id);
                    }
                }}
                whileTap={{ cursor: "grabbing" }}
                style={{ x }}
                className="relative z-10 bg-[var(--bg-card)] border border-[var(--border-color)] p-5 rounded-3xl shadow-2xl transition-all hover:border-[var(--text-muted)]/30 cursor-pointer select-none"
                onClick={() => {
                    if (x.get() === 0) onSelect(data);
                }}
            >
                {/* Header: Title, Segment, Status & Price/PnL */}
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
                                {formatTradingSymbol(tradingsymbol) || "—"}
                            </h4>
                            <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
                                {data.segment || "NFO"}
                            </span>
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${data.order_status === 'RESTRICTED' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-[var(--loss-text)] bg-[var(--loss-chip-bg)]'}`}>
                                {data.order_status || "CLOSED"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase">
                            <span>{data.product || "MIS"} • {data.segment}</span>
                            <span className={`px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
                                {sideUpper}
                            </span>
                            <span>• {qty} QTY</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {data.order_status === 'RESTRICTED' ? (
                            <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                                Restricted
                            </span>
                        ) : (
                            <>
                                <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5 text-right">
                                    ₹{exitPrice.toFixed(2)}
                                </div>
                                <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${pnlChipBg} ${pnlTextColor}`}>
                                    {pctText}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Info Grid */}
                {data.order_status === 'RESTRICTED' ? (
                    <div className="grid grid-cols-2 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 text-center">
                        <div className="flex flex-col gap-1">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Entry Price</p>
                            <p className="text-xs font-black text-[var(--text-primary)]">₹{entryPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
                            <p className="text-xs font-black text-[var(--text-primary)]">{qty}</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 text-center">
                        <div className="flex flex-col gap-1">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Entry Price</p>
                            <p className="text-xs font-black text-[var(--text-primary)]">₹{entryPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Exit Price</p>
                            <p className="text-xs font-black text-[var(--text-primary)]">₹{exitPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
                            <p className={`text-xs font-black ${pnlTextColor}`}>₹{netPnl.toFixed(2)}</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// --- Internal Component: ClosedOrderBottomWindow ---
const ClosedOrderBottomWindow = ({ selectedOrder, onClose }) => {
    if (!selectedOrder) return null;
    //console.log(selectedOrder);

    // 1. Get User Role for Permissions
    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role; // 'broker' or 'customer'
    const isOpen = logMarketStatus();

    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editQty, setEditQty] = useState('');
    const [editEntry, setEditEntry] = useState('');
    const [editExit, setEditExit] = useState('');
    const [editDate, setEditDate] = useState('');

    // Fix: Read from DB field 'expire', with fallback to meta fields
    const expireDate = selectedOrder.expire
        || selectedOrder.meta?.expiry
        || selectedOrder.meta?.selectedStock?.expiry;
    const date = expireDate ? new Date(expireDate) : null;
    const formattedStockExpireDate = date && !isNaN(date) ? (
        String(date.getDate()).padStart(2, '0') + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        date.getFullYear()
    ) : "—";

    const {
        symbol, side, product, lots, lot_size, closed_at,
        _id: orderId, instrument_token, segment, quantity, price, came_From
    } = selectedOrder;

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';

    const { qty, entryPrice, exitPrice } = getOrderValues(selectedOrder);

    // Initialize edit values on mount/change
    useEffect(() => {
        setEditQty(qty);
        setEditEntry(entryPrice);
        setEditExit(exitPrice);
        const d = closed_at ? new Date(closed_at) : new Date();
        const pad = (n) => String(n).padStart(2, '0');
        setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        
        setIsEditing(false); // Reset edit mode when order changes
        setFeedback(null);
    }, [selectedOrder, qty, entryPrice, exitPrice, closed_at]);


    // 🔹 EXIT P&L + FULL BROKERAGE (entry + exit) helper se
    // Calculate P&L based on EDIT values if editing, else original
    const currentEntry = isEditing ? Number(editEntry) : entryPrice;
    const currentExit = isEditing ? Number(editExit) : exitPrice;

    const {
        exitValue,
        brokerageEntry,
        brokerageExit,
        grossPnl,
        netPnl,
        pct
    } = calculateExitBrokerageAndPnL({
        side: orderSide,
        avgPrice: currentEntry,
        exitPrice: currentExit,
        qty,
        symbol: tradingsymbol
    });

    const isZero = Math.abs(netPnl) < 0.01;
    const profit = netPnl > 0;

    const pnlChipBg = isZero ? "bg-transparent" : (profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]");
    const pnlTextColor = isZero ? "text-[var(--text-primary)]" : (profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]");

    const { isLocked } = usePermissions();
    const hideOrderDates = isLocked('hide_order_dates');

    const closedTime = hideOrderDates ? "-" : (closed_at ? (() => {
        const d = new Date(closed_at);
        const datePart = String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
        const timePart = d.toLocaleTimeString();
        return `${datePart}, ${timePart}`;
    })() : "—");

    // --- REOPEN LOGIC ---
    const handleReopen = async () => {
        setSubmitting(true);
        setFeedback(null);

        try {
            const activeContextString = localStorage.getItem('activeContext');
            const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
            const brokerId = activeContext.brokerId;
            const customerId = activeContext.customerId;
            const token = localStorage.getItem("token") || null;
            const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
            const endpoint = `${apiBase}/api/orders/updateOrder`;

            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                instrument_token: instrument_token,
                symbol: tradingsymbol,
                side: orderSide,
                product: product,
                segment: segment,
                lots: String(lots),
                quantity: Number(quantity),
                price: Number(price),
                order_status: "OPEN", // Reopening
                meta: { from: 'ui_closed_order_reopen' }
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) throw new Error(body?.message || body?.error || `Server error: ${res.status}`);
            if (body && body.success === false) throw new Error(body.message || 'Server returned failure');

            setFeedback({ type: 'success', message: 'Order Reopened Successfully!' });

            // Notify app
            try { window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } })); } catch (e) { }

            setTimeout(() => { onClose(); }, 1000);

        } catch (err) {
            console.error("Reopen error:", err);
            setFeedback({ type: 'error', message: `Failed to reopen: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    // --- SAVE EDITED PRICES ---
    const handleSavePrices = async () => {
        setSubmitting(true);
        setFeedback(null);
        try {
            const token = localStorage.getItem("token") || null;
            const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
            // Use the NEW safe endpoint
            const endpoint = `${apiBase}/api/orders/updateClosedOrderPrices`;

            const payload = {
                order_id: orderId,
                quantity: Number(editQty),
                price: Number(editEntry),
                closed_ltp: isRestricted ? undefined : Number(editExit),
                closed_at: editDate ? new Date(editDate).toISOString() : null
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) throw new Error(body?.message || body?.error || `Server error: ${res.status}`);
            if (body && body.success === false) throw new Error(body.message || 'Failed to update prices');

            setFeedback({ type: 'success', message: 'Prices Updated Successfully!' });
            setIsEditing(false);

            // Notify app to refresh list
            try { window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } })); } catch (e) { }

            setTimeout(() => { onClose(); }, 500);

        } catch (err) {
            console.error("Update error:", err);
            setFeedback({ type: 'error', message: `Failed to update: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };


    const isRestricted = selectedOrder.order_status === "RESTRICTED";

    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-2xl p-4 transition-transform duration-300 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-3 border-b border-[var(--border-color)] pb-2">
                <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-base sm:text-lg text-[var(--text-primary)] font-bold tracking-wide truncate">{formatTradingSymbol(tradingsymbol)}</h3>
                    <span className="text-xs text-[var(--text-secondary)]">({orderSide})</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Edit Mode */}
                    {!isEditing && (userRole === 'broker') && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 rounded-full text-[#3b82f6] hover:bg-[#3b82f6]/10 transition"
                            title="Edit Prices"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-shrink-0">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]' : 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]'}`}>
                    {feedback.message}
                </div>
            )}

            {/* P&L Display - LIVE UPDATE DURING EDIT */}
            {!isRestricted && (
                <div className="mb-4 flex justify-between items-end">
                    <div>
                        <p className="text-xl font-bold">
                            <span className="text-[var(--text-secondary)] mr-1">₹</span>
                            <span className="text-[var(--text-primary)]">{isEditing ? currentExit.toFixed(2) : exitPrice.toFixed(2)}</span>
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Exit Price</p>
                    </div>
                    <div className="text-right">
                        <span className={`text-xl font-bold px-2.5 py-1 rounded-lg ${pnlChipBg} ${pnlTextColor}`}>{money(netPnl)}</span>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5">Realized P&L (After Brokerage)</p>
                    </div>
                </div>
            )}

            {isRestricted && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                    <p className="text-amber-500 text-sm font-bold uppercase tracking-wider">Restricted Position</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">This order is restricted. It can be re-opened to resume trading.</p>
                </div>
            )}

            {/* Brokerage Breakdown */}
            {!isRestricted && (
                <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] text-[11px]">
                    <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                        <span>Gross P&L</span>
                        <span className="font-medium">{money(grossPnl)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                        <span>Entry Brokerage 0.01%</span>
                        <span className="text-[var(--loss-text)]">-{money(brokerageEntry)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Exit Brokerage 0.01%</span>
                        <span className="text-[var(--loss-text)]">-{money(brokerageExit)}</span>
                    </div>
                    <div className="flex justify-between mt-2 border-t border-[var(--border-color)] pt-2 font-bold uppercase tracking-tighter">
                        <span>Net Realized</span>
                        <span className={pnlTextColor}>{money(netPnl)} ({pct.toFixed(2)}%)</span>
                    </div>
                </div>
            )}

            {/* Details Grid (Compact) */}
            <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] text-xs space-y-1.5">
                
                {/* EDITABLE QUANTITY */}
                <div className="flex justify-between items-center py-0.5 px-2">
                    <div className="flex items-center text-[var(--text-secondary)]"><span className="text-xs">Quantity</span></div>
                    {isEditing ? (
                        <input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-right w-24 text-[var(--text-primary)] focus:outline-none focus:border-[#3b82f6]"
                        />
                    ) : (
                        <span className="text-sm font-medium text-[var(--text-primary)]">{qty} shares</span>
                    )}
                </div>

                {/* EDITABLE ENTRY PRICE */}
                <div className="flex justify-between items-center py-0.5 px-2">
                    <div className="flex items-center text-[var(--text-secondary)]"><span className="text-xs">Entry Price</span></div>
                    {isEditing ? (
                        <input
                            type="number"
                            value={editEntry}
                            onChange={(e) => setEditEntry(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-right w-24 text-[var(--text-primary)] focus:outline-none focus:border-[#3b82f6]"
                        />
                    ) : (
                        <span className="text-sm font-medium text-[var(--text-primary)]">{money(entryPrice)}</span>
                    )}
                </div>

                {/* EDITABLE EXIT PRICE */}
                {!isRestricted && (
                    <div className="flex justify-between items-center py-0.5 px-2">
                        <div className="flex items-center text-[var(--text-secondary)]"><span className="text-xs">Exit Price</span></div>
                        {isEditing ? (
                            <input
                                type="number"
                                value={editExit}
                                onChange={(e) => setEditExit(e.target.value)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-right w-24 text-[var(--text-primary)] focus:outline-none focus:border-[#3b82f6]"
                            />
                        ) : (
                            <span className="text-sm font-medium text-[var(--text-primary)]">{money(exitPrice)}</span>
                        )}
                    </div>
                )}

                <DetailRow label="Type" value={orderSide} />
                <DetailRow label="Product" value={productType} colorClass="text-[#3b82f6]" />
                <DetailRow label="From" value={came_From} colorClass="text-[#3b82f6]" />
                
                {/* EDITABLE CLOSED / RESTRICTED AT DATE */}
                <div className="flex justify-between items-center py-0.5 px-2">
                    <div className="flex items-center text-[var(--text-secondary)]">
                        <span className="text-xs">{isRestricted ? "Restricted At" : "Closed At"}</span>
                    </div>
                    {isEditing ? (
                        <input
                            type="datetime-local"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-right text-[var(--text-primary)] focus:outline-none focus:border-[#3b82f6]"
                        />
                    ) : (
                        <span className="text-[var(--text-muted)] text-xs font-medium">{closedTime}</span>
                    )}
                </div>
                
                <DetailRow label="Expire Date" value={formattedStockExpireDate} colorClass="text-[var(--text-muted)] text-xs" />
            </div>

            {/* Actions */}
            <div className="flex space-x-3 mt-4">
                {isEditing ? (
                    <>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 p-3.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-primary)] transition border border-[var(--border-color)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSavePrices}
                            disabled={submitting}
                            className={`flex-1 p-3.5 rounded-xl font-bold text-white transition flex items-center justify-center gap-2 shadow-lg
                             ${submitting ? 'bg-[#089981]/50 cursor-not-allowed' : 'bg-[#089981] hover:brightness-110 shadow-[#089981]/20'}`}
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={onClose}
                            className="flex-1 p-3.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-primary)] transition border border-[var(--border-color)]"
                        >
                            Close
                        </button>

                        {/* Condition: User must be Broker AND (Not Hold/Overnight OR Market Open OR Restricted) */}
                        {String(userRole || '').toLowerCase() === 'broker' && (isRestricted || (came_From !== 'Hold' && came_From !== 'Overnight') || isOpen) && (
                            <button
                                onClick={handleReopen}
                                disabled={submitting}
                                className={`flex-1 p-3.5 rounded-xl font-bold text-white transition flex items-center justify-center gap-2 shadow-lg
                                ${submitting ? 'bg-[#3b82f6]/50 cursor-not-allowed' : 'bg-[#3b82f6] hover:brightness-110 shadow-[#3b82f6]/20'}`}
                            >
                                {submitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        To Open
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


// --- Main Component: ClosedOrder ---

export default function ClosedOrder({ filter }) {
    const [closedOrders, setClosedOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [subTab, setSubTab] = useState('CLOSED'); // 'CLOSED' or 'RESTRICTED'
    const [loader, setLoader] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderData, setSelectedOrderData] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // Modal State
    const [deleteTarget, setDeleteTarget] = useState(null); // null, 'ALL', or specific orderId
    const [isDeleting, setIsDeleting] = useState(false);

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;
    const token = localStorage.getItem("token") || null;
    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    // Get user role for permission checks
    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;

    const orderStatus = "CLOSED";

    // --- Toast Handler ---
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
    };

    const handleOrderSelect = (orderData) => {
        setSelectedOrderData(orderData);
    };

    const handleCloseWindow = () => {
        setSelectedOrderData(null);
    };

    // --- Global Filter Application ---
    useEffect(() => {
        if (!closedOrders || closedOrders.length === 0) {
            setFilteredOrders([]);
            return;
        }

        if (!filter || filter === 'All') {
            setFilteredOrders(closedOrders.slice());
            return;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filtered = closedOrders.filter(o => {
            const closedAtRaw = o?.closed_at || o?.closedAt || o?.updatedAt || o?.createdAt;
            if (!closedAtRaw) return true;
            const closed = new Date(closedAtRaw);

            if (filter === 'Today') {
                return closed >= startOfToday;
            }
            if (filter === 'Last 7 Days') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return closed >= sevenDaysAgo;
            }
            if (filter === 'Last 30 Days') {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return closed >= thirtyDaysAgo;
            }
            return true;
        });

        setFilteredOrders(filtered);
    }, [closedOrders, filter]);

    const displayList = useMemo(() => {
        return filteredOrders.filter(o => o.order_status === subTab);
    }, [filteredOrders, subTab]);

    const fetchClosedOrders = async () => {
        if (!brokerId || !customerId) {
            setLoader(false);
            return;
        }
        setLoader(true);
        try {
            const endPoint = `${apiBase.replace(/\/$/, "")}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=ALL`;
            const res = await fetch(endPoint, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                credentials: "include",
            });

            if (!res.ok) {
                setClosedOrders([]);
                setFilteredOrders([]);
                setError("Failed to load closed orders");
                return;
            }

            const data = await res.json();
            const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : (Array.isArray(data) ? data : []);
            
            // Only CLOSED or RESTRICTED
            const targetOrders = orders.filter(o => o.order_status === 'CLOSED' || o.order_status === 'RESTRICTED');

            // Sort by latest activity (closed_at, updatedAt, or createdAt) desc
            const sortedOrders = [...targetOrders].sort((a, b) => {
                const getTime = (o) => {
                    const dates = [o.closed_at, o.closedAt, o.updatedAt, o.createdAt]
                        .filter(Boolean)
                        .map(d => new Date(d).getTime())
                        .filter(t => !isNaN(t));
                    return dates.length > 0 ? Math.max(...dates) : 0;
                };
                return getTime(b) - getTime(a);
            });

            setClosedOrders(sortedOrders);
            setFilteredOrders(sortedOrders.slice());
            setError(null);
        } catch (err) {
            console.error("fetchClosedOrders exception:", err);
            setClosedOrders([]);
            setFilteredOrders([]);
            setError(String(err));
        } finally {
            setLoader(false);
        }
    };

    // --- Delete Handlers ---
    const handleDeleteOrder = (orderId) => {
        setDeleteTarget(orderId);
    };

    const handleDeleteAllClick = () => {
        if (filteredOrders.length === 0) return;
        setDeleteTarget("ALL");
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);

        try {
            let url = "";
            let body = {};

            if (deleteTarget === "ALL") {
                url = `${apiBase}/api/orders/deleteAllClosedOrders`;
                body = { broker_id_str: brokerId, customer_id_str: customerId };
            } else {
                url = `${apiBase}/api/orders/deleteOrder`;
                body = { order_id: deleteTarget };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.success) {
                const msg = deleteTarget === "ALL"
                    ? `All Orders Deleted (${data.message})`
                    : "Order Deleted Successfully";
                showToast(msg, deleteTarget === "ALL" ? "success" : "error"); // Red toast for single delete usually implies significant action

                fetchClosedOrders();
                setDeleteTarget(null);
            } else {
                showToast(data.message || "Failed to delete", "error");
            }
        } catch (e) {
            console.error(e);
            showToast("Server Error", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        fetchClosedOrders();
        const handler = () => fetchClosedOrders();
        window.addEventListener('orders:changed', handler);
        return () => window.removeEventListener('orders:changed', handler);
    }, [brokerId, customerId, apiBase, token]);

    // Modal Content Helper
    const isAll = deleteTarget === "ALL";
    const modalTitle = isAll ? "Delete All Closed Orders?" : "Delete This Order?";
    const modalDesc = isAll
        ? `Are you sure you want to delete all ${filteredOrders.length} closed orders? This action cannot be undone.`
        : "Are you sure you want to delete this closed order? This action cannot be undone.";
    const confirmBtnText = isAll ? "Yes, Delete All" : "Yes, Delete";

      // ---- SKELETON LOADER ----
  const OrderCardSkeleton = () => (
    <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] mb-4 shadow-xl animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2 mb-2"></div>
          <div className="h-1.5 bg-[var(--bg-secondary)] rounded w-1/4"></div>
        </div>
        <div className="text-right">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-16 mb-2 ml-auto"></div>
          <div className="h-5 bg-[var(--bg-secondary)] rounded-full w-20 ml-auto"></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)]/50 p-2.5 rounded-xl border border-[var(--border-color)]">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-1.5 bg-[var(--bg-secondary)] rounded w-6"></div>
            <div className="h-3 bg-[var(--bg-secondary)] rounded w-10"></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loader) {
    return (
      <div className="flex flex-col px-1">
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-32 animate-pulse"></div>
        </div>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </div>
    );
  }

    return (
        <>
            <Toast show={toast.show} message={toast.message} type={toast.type} />
            <div className="flex flex-col md:grid md:grid-cols-[280px_1fr] gap-4 h-full overflow-hidden">
                {/* Left: Filter Sidebar */}
                {/* <div className="flex-shrink-0">
                    <ClosedOrderFilter
                        closedOrders={closedOrders}
                        onFilter={(newList) => setFilteredOrders(newList)}
                    />
                </div> */}

                {/* Right: Order List */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Modern Sub-Tab Toggle */}
                    <div className="flex gap-2 mb-3 bg-[var(--bg-secondary)] p-1 rounded-2xl flex-shrink-0">
                        <button
                            onClick={() => setSubTab('CLOSED')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 ${subTab === 'CLOSED' ? 'bg-[#1e293b] text-white shadow-lg border border-white/5' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Closed Positions
                        </button>
                        <button
                            onClick={() => setSubTab('RESTRICTED')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 ${subTab === 'RESTRICTED' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Restricted
                        </button>
                    </div>

                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                        <h3 className="text-[var(--text-secondary)] text-sm">
                            {subTab === 'RESTRICTED' ? 'Restricted Orders' : 'Closed Orders'} ({displayList.length})
                        </h3>
                        {displayList.length > 0 && userRole === 'broker' && (
                            <button
                                onClick={handleDeleteAllClick}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 bg-red-500/10 px-2 py-1 rounded"
                            >
                                <Trash2 className="w-3 h-3" /> Clear All
                            </button>
                        )}
                    </div>

                    {loader ? (
                        <div className="flex-1 px-1">
                            <OrderCardSkeleton />
                            <OrderCardSkeleton />
                            <OrderCardSkeleton />
                            <OrderCardSkeleton />
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="text-[var(--text-muted)] text-center py-8 text-[10px] font-black uppercase tracking-widest italic">
                            No {subTab === 'RESTRICTED' ? 'restricted' : 'closed'} positions found.
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pb-24 px-1">
                            {displayList.map((data, idx) => (
                                <SwipeableClosedOrderItem
                                    key={data._id || idx}
                                    data={data}
                                    onSelect={handleOrderSelect}
                                    onDelete={userRole === 'broker' ? handleDeleteOrder : () => { }}
                                />
                            ))}
                        </div>
                    )}

                    {selectedOrderData && (
                        <ClosedOrderBottomWindow
                            selectedOrder={selectedOrderData}
                            onClose={handleCloseWindow}
                        />
                    )}

                    {/* DYNAMIC DELETE CONFIRMATION MODAL */}
                    {deleteTarget && userRole === 'broker' && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                                onClick={() => !isDeleting && setDeleteTarget(null)}
                            />
                            <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle className="text-red-500 w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                                        {modalTitle}
                                    </h3>
                                    <p className="text-[var(--text-secondary)] text-sm mb-6">
                                        {modalDesc}
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setDeleteTarget(null)}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={executeDelete}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Deleting...
                                                </>
                                            ) : (
                                                confirmBtnText
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
