import React, { useState, useEffect } from 'react';
import { ShoppingCart, Zap, XCircle, Pencil, Check, Save, TrendingUp, TrendingDown, Plus, Minus, ChevronDown, ArrowLeft, AlertTriangle } from 'lucide-react';
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { logMarketStatus } from '../../../Utils/marketStatus.js';
import { calculatePnLAndBrokerage, formatTradingSymbolNew } from '../../../Utils/calculateBrokerage.jsx';
import LockedButtonWrapper from '../../../components/LockedButtonWrapper';
import { usePermissions } from '../../../contexts/PermissionsContext.jsx';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

export default function OpenOrderBottomWindow({ selectedOrder, onClose, sheetData }) {
    if (!selectedOrder) return null;

    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;
    const isMarketOpen = logMarketStatus(selectedOrder?.segment);

    // Fix: Read from DB field 'expire', with fallback to meta fields
    const expireDate = selectedOrder.expire
        || selectedOrder.meta?.expiry
        || selectedOrder.meta?.selectedStock?.expiry;
    const date = expireDate ? new Date(expireDate) : null;
    const formattedStockExpireDate = date && !isNaN(date)
        ? String(date.getDate()).padStart(2, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + date.getFullYear()
        : 'N/A';

    const { isLocked } = usePermissions();
    const hideOrderDates = isLocked('hide_order_dates');

    // Order placed date
    const placedDate = selectedOrder.placed_at || selectedOrder.createdAt;
    const formattedPlacedDate = hideOrderDates ? '-' : (placedDate ? (() => {
        const d = new Date(placedDate);
        return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear()
            + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    })() : 'N/A');

    const {
        symbol, side, product, quantity: initialQty, price: initialPrice,
        instrument_token, _id: orderId, lots, margin_blocked
    } = selectedOrder;

    const lotSize = Number(selectedOrder.lot_size) || Number(selectedOrder.meta?.selectedStock?.lot_size) || 1;
    const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
    const avg = Number(initialPrice ?? 0);
    const currentPrice = ltpRaw || avg || 0;
    
    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';
    const isBuy = orderSide === 'BUY';

    // (Jobbing Point applied ONLY upon execution of Exit, not on Display)
    let pnlLtp = currentPrice;

    const {
        grossPnl,
        totalBrokerage,
        netPnl,
    } = calculatePnLAndBrokerage({
        side: orderSide,
        avgPrice: avg,
        ltp: pnlLtp,
        qty: Number(initialQty ?? 0),
        brokeragePercentPerSide: 0.01,
        mode: "entry-only",
        symbol: tradingsymbol,
    });

    // States
    const [showDetails, setShowDetails] = useState(false);
    const [addLotInput, setAddLotInput] = useState('');
    const [slPrice, setSlPrice] = useState(selectedOrder.stop_loss || '');
    const [targetPrice, setTargetPrice] = useState(selectedOrder.target || '');
    const [submitting, setSubmitting] = useState(false);
    const [action, setAction] = useState('Adjust');
    const [feedback, setFeedback] = useState(null);
    const [jobbingPointInput, setJobbingPointInput] = useState(selectedOrder.jobbing_point || '');
    const [savedJobbingPoint, setSavedJobbingPoint] = useState(selectedOrder.jobbing_point || 0);
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [editPriceInput, setEditPriceInput] = useState('');
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [editDateInput, setEditDateInput] = useState('');
    const [jobbingAppliedLtpState, setJobbingAppliedLtpState] = useState(selectedOrder.jobbing_applied_ltp || 0);
    const [customerExitPriceInput, setCustomerExitPriceInput] = useState(selectedOrder.customer_exit_price || '');
    const [savedCustomerExitPrice, setSavedCustomerExitPrice] = useState(selectedOrder.customer_exit_price || 0);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || null;
    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    useEffect(() => {
        setCustomerExitPriceInput(selectedOrder.customer_exit_price || '');
        setSavedCustomerExitPrice(selectedOrder.customer_exit_price || 0);
        setJobbingPointInput(selectedOrder.jobbing_point || '');
        setSavedJobbingPoint(selectedOrder.jobbing_point || 0);
        setJobbingAppliedLtpState(selectedOrder.jobbing_applied_ltp || 0);

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

    const currentLots = Number(lots ?? 0);
    const parsedAddLots = Math.max(0, parseInt(String(addLotInput).trim() || '0', 10));
    const targetTotalLots = currentLots + parsedAddLots;
    const targetTotalQuantity = targetTotalLots * lotSize;

    let computedAvg = avg;
    let jobbingAdjustedNewPrice = currentPrice;
    if (parsedAddLots > 0) {
        const orderJobbing = Number(selectedOrder.increase_price || 0);
        const orderJobbinType = selectedOrder.jobbin_type || 'percentage';
        const orderSideIsBuy = isBuy;

        if (orderJobbing > 0 && currentPrice > 0) {
            if (orderJobbinType === 'points') {
                // BUY -> + (price badh jayegi), SELL -> - (price kam hogi)
                jobbingAdjustedNewPrice = orderSideIsBuy ? currentPrice + orderJobbing : currentPrice - orderJobbing;
            } else {
                // Percentage mode
                const factor = orderSideIsBuy ? (1 + orderJobbing / 100) : (1 - orderJobbing / 100);
                jobbingAdjustedNewPrice = currentPrice * factor;
            }
        }
        const existingVal = Number(initialQty ?? 0) * avg;
        const newVal = (parsedAddLots * lotSize) * jobbingAdjustedNewPrice;
        computedAvg = (existingVal + newVal) / targetTotalQuantity;
    }

    const handlePriceSave = async () => {
        if (!editPriceInput || isNaN(Number(editPriceInput)) || Number(editPriceInput) < 0) {
            setFeedback({ type: 'error', message: 'Invalid Price' });
            return;
        }
        setSubmitting(true);
        try {
            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                price: Number(editPriceInput),
                meta: { from: 'ui_open_order_window_edit_price' }
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Server error");
            setFeedback({ type: 'success', message: 'Price Updated Successfully!' });
            setIsEditingPrice(false);
            window.dispatchEvent(new CustomEvent('orders:changed'));
        } catch (err) {
            setFeedback({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDateSave = async () => {
        if (!editDateInput) {
            setFeedback({ type: 'error', message: 'Invalid Date' });
            return;
        }
        setSubmitting(true);
        try {
            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                placed_at: new Date(editDateInput).toISOString(),
                meta: { from: 'ui_open_order_window_edit_date' }
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Server error");
            setFeedback({ type: 'success', message: 'Date Updated Successfully!' });
            setIsEditingDate(false);
            window.dispatchEvent(new CustomEvent('orders:changed'));
        } catch (err) {
            setFeedback({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (clickedAction, targetStatus) => {
        setSubmitting(true);
        setAction(clickedAction);
        setFeedback(null);
        try {
            if (targetStatus === 'OPEN') {
                const sl = Number(slPrice) || 0;
                const tgt = Number(targetPrice) || 0;
                if (currentPrice > 0) {
                    if (isBuy) {
                        if (sl > 0 && sl >= currentPrice) { setFeedback({ type: 'error', message: 'SL must be < CMP' }); setSubmitting(false); return; }
                        if (tgt > 0 && tgt <= currentPrice) { setFeedback({ type: 'error', message: 'Target must be > CMP' }); setSubmitting(false); return; }
                    } else {
                        if (sl > 0 && sl <= currentPrice) { setFeedback({ type: 'error', message: 'SL must be > CMP' }); setSubmitting(false); return; }
                        if (tgt > 0 && tgt >= currentPrice) { setFeedback({ type: 'error', message: 'Target must be < CMP' }); setSubmitting(false); return; }
                    }
                }
                if (parsedAddLots > 0) {
                    const fundsData = await getFundsData();
                    const requiredAmount = (parsedAddLots * lotSize) * jobbingAdjustedNewPrice;
                    const availableLimit = productType === 'Intraday' ? (fundsData.intraday?.available_limit - fundsData.intraday?.used_limit) : (fundsData.overnight?.available_limit || 0);
                    if (requiredAmount > availableLimit) {
                        setFeedback({ type: 'error', message: `Insufficient Funds! Required: ₹${requiredAmount.toFixed(2)}` });
                        setSubmitting(false); return;
                    }
                }
            }

            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            let payload;
            if (targetStatus === 'OPEN') {
                payload = {
                    broker_id_str: brokerId, customer_id_str: customerId, order_id: orderId,
                    lots: String(targetTotalLots), quantity: Number(targetTotalQuantity),
                    price: Number(Number(computedAvg).toFixed(2)), stop_loss: Number(slPrice || 0),
                    target: Number(targetPrice || 0), jobbing_point: Number(jobbingPointInput || 0),
                    order_status: 'OPEN', came_From: 'Open', meta: { from: 'ui_open_order_window' }
                };
            } else {
                let closedLtp;
                if (Number(savedCustomerExitPrice) > 0) {
                    closedLtp = Number(savedCustomerExitPrice);
                } else {
                    const refLtp = Number(jobbingAppliedLtpState || 0) || currentPrice;
                    closedLtp = refLtp;
                    const jpValue = Number(savedJobbingPoint || 0);
                    if (jpValue > 0 && closedLtp > 0) {
                        closedLtp = isBuy ? closedLtp - jpValue : closedLtp + jpValue;
                    }
                }
                payload = {
                    broker_id_str: brokerId, customer_id_str: customerId, order_id: orderId,
                    closed_ltp: Number(closedLtp.toFixed(4)), order_status: targetStatus,
                    came_From: targetStatus === 'HOLD' ? 'Hold' : 'Open'
                };
            }
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Action failed");
            setFeedback({ type: 'success', message: 'Success!' });
            window.dispatchEvent(new CustomEvent('orders:changed'));
            setTimeout(onClose, 1000);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveJobbingOnly = async () => {
        setSubmitting(true);
        setAction('SaveJobbing');
        try {
            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                jobbing_point: Number(jobbingPointInput || 0),
                jobbing_applied_ltp: Number(currentPrice || 0),
                meta: { from: 'ui_open_order_window_jobbing_save' }
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            const jpVal = Number(jobbingPointInput || 0);
            const jpLtp = Number(currentPrice || 0);
            setSavedJobbingPoint(jpVal);
            setJobbingAppliedLtpState(jpLtp);
            if (jpVal > 0) {
                setSavedCustomerExitPrice(0);
                setCustomerExitPriceInput('');
            }
            setFeedback({ type: 'success', message: 'Jobbing Point Saved!' });
            window.dispatchEvent(new CustomEvent('orders:changed', {
                detail: { order: { ...selectedOrder, jobbing_point: jpVal, jobbing_applied_ltp: jpLtp, customer_exit_price: jpVal > 0 ? 0 : savedCustomerExitPrice } }
            }));
        } catch (err) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveCustomerExitPriceOnly = async () => {
        setSubmitting(true);
        setAction('SaveCustomerExitPrice');
        try {
            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                customer_exit_price: Number(customerExitPriceInput || 0),
                meta: { from: 'ui_open_order_window_customer_exit_save' }
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save customer exit price");
            const custPriceVal = Number(customerExitPriceInput || 0);
            setSavedCustomerExitPrice(custPriceVal);
            if (custPriceVal > 0) {
                setSavedJobbingPoint(0);
                setJobbingPointInput('');
                setJobbingAppliedLtpState(0);
            }
            setFeedback({ type: 'success', message: 'Customer Exit Price Saved!' });
            window.dispatchEvent(new CustomEvent('orders:changed', {
                detail: { order: { ...selectedOrder, customer_exit_price: custPriceVal, jobbing_point: custPriceVal > 0 ? 0 : savedJobbingPoint, jobbing_applied_ltp: custPriceVal > 0 ? 0 : jobbingAppliedLtpState } }
            }));
        } catch (err) {
            setFeedback({ type: 'error', message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-[var(--bg-primary)] text-[var(--text-secondary)] font-sans flex flex-col overflow-hidden animate-in fade-in duration-300">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
                <div className="flex flex-col">
                    <h3 className="text-lg font-black text-[var(--text-primary)] leading-tight">{formatTradingSymbolNew(tradingsymbol)}</h3>
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
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-[var(--bg-card)] px-3 py-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Live Price</p>
                        <p className="text-xl font-black text-[var(--text-primary)] leading-none">₹{Number(currentPrice || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-[var(--bg-card)] px-3 py-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Unrealized P&L</p>
                        <p className={`text-xl font-black leading-none ${netPnl >= 0 ? 'text-[var(--gain-text)]' : 'text-[var(--loss-text)]'}`}>
                            {money(netPnl)}
                        </p>
                    </div>
                </div>

                {feedback && (
                    <div className={`p-2 mb-4 rounded-lg text-[11px] font-bold text-center border animate-in slide-in-from-top-1 ${feedback.type === 'error' ? 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)] border-[var(--loss-chip-bg)]/20' : 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)] border-[var(--gain-chip-bg)]/20'}`}>
                        {feedback.message}
                    </div>
                )}

                <div className="space-y-3 mb-4">
                    <div className="bg-[var(--bg-card)] p-3.5 rounded-2xl border border-[var(--border-color)]">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Modify Lots (+/-)</span>
                            <span className="text-[9px] font-black text-[#3b82f6]">Total: {targetTotalQuantity}</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <button onClick={() => setAddLotInput(String(Math.max(0, (Number(addLotInput) || 0) - 1)))} className="w-9 h-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center active:scale-90"><Minus size={14} /></button>
                             <div className="flex-1">
                                <input type="number" value={addLotInput} onChange={(e) => setAddLotInput(e.target.value)} className="bg-transparent text-center text-3xl font-black text-[var(--text-primary)] w-full outline-none" placeholder="0" />
                             </div>
                             <button onClick={() => setAddLotInput(String((Number(addLotInput) || 0) + 1))} className="w-9 h-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center active:scale-90"><Plus size={14} /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-[var(--bg-card)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                            <span className="text-[8px] font-black text-[var(--loss-text)] uppercase mb-1 block">Stop Loss</span>
                            <input type="number" value={slPrice} onChange={(e) => setSlPrice(e.target.value)} className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none" placeholder="0.00" />
                        </div>
                        <div className="bg-[var(--bg-card)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                            <span className="text-[8px] font-black text-[var(--gain-text)] uppercase mb-1 block">Target</span>
                            <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none" placeholder="0.00" />
                        </div>
                    </div>

                    {userRole === 'broker' && (
                        <>
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="bg-[var(--bg-card)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1 flex justify-between items-center">
                                        Avg Price 
                                        <button onClick={isEditingPrice ? handlePriceSave : () => { setEditPriceInput(Number(computedAvg || 0).toFixed(2)); setIsEditingPrice(true); }} className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors">
                                            {isEditingPrice ? <Check size={12} className="text-[var(--gain-text)]" /> : <Pencil size={12} className="text-[var(--text-muted)]" />}
                                        </button>
                                    </span>
                                    {isEditingPrice ? (
                                        <input type="number" value={editPriceInput} onChange={(e) => setEditPriceInput(e.target.value)} className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none" autoFocus />
                                    ) : (
                                        <p className="text-lg font-black text-[var(--text-primary)] truncate">{Number(computedAvg || 0).toFixed(2)}</p>
                                    )}
                                </div>
                                <div className="bg-[var(--bg-card)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1 flex justify-between items-center">
                                        Jobbing 
                                        <button onClick={handleSaveJobbingOnly} className="px-2 py-0.5 bg-[var(--gain-chip-bg)] text-[var(--gain-text)] text-[9px] font-black rounded hover:bg-[var(--gain-chip-bg)]/30 transition-colors uppercase">
                                            Save
                                        </button>
                                    </span>
                                    <input type="number" value={jobbingPointInput} onChange={(e) => setJobbingPointInput(e.target.value)} className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none" placeholder="0" />
                                </div>
                            </div>
                            <div className="bg-[var(--bg-card)] px-3 py-2.5 rounded-xl border border-[var(--border-color)]">
                                <span className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1 flex justify-between items-center">
                                    Customer Exit Price 
                                    <button onClick={handleSaveCustomerExitPriceOnly} className="px-2 py-0.5 bg-[var(--gain-chip-bg)] text-[var(--gain-text)] text-[9px] font-black rounded hover:bg-[var(--gain-chip-bg)]/30 transition-colors uppercase">
                                        Save
                                    </button>
                                </span>
                                <input type="number" value={customerExitPriceInput} onChange={(e) => setCustomerExitPriceInput(e.target.value)} className="bg-transparent text-lg font-black text-[var(--text-primary)] w-full outline-none" placeholder="0.00" />
                            </div>
                        </>
                    )}
                </div>

                <div className="mb-4">
                    <button 
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between py-3 border-t border-[var(--border-color)] group active:bg-[var(--bg-secondary)] rounded-lg px-2 transition-all"
                    >
                        <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-[2px]">View Detail</span>
                        <div className={`transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>
                             <ChevronDown size={18} className="text-[#3b82f6]" />
                        </div>
                    </button>

                    {showDetails && (
                        <div className="bg-[var(--bg-card)]/60 rounded-2xl p-4 border border-[var(--border-color)] space-y-3 animate-in fade-in zoom-in-95">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Quantity</span>
                                <span className="text-blue-400 font-black">{initialQty} shares</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Lots</span>
                                <span className="text-[var(--text-primary)] font-black">{lots} lots</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Avg. Buy Price</span>
                                <span className="text-[#f59e0b] font-black">₹{Number(initialPrice || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Type</span>
                                <span className={`font-black ${isBuy ? 'text-[var(--gain-text)]' : 'text-[var(--loss-text)]'}`}>{orderSide}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Order Instant</span>
                                <span className="text-[var(--text-primary)] font-black">{productType}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Order Date</span>
                                <div className="flex items-center gap-2">
                                    {isEditingDate ? (
                                        <>
                                            <input 
                                                type="datetime-local" 
                                                value={editDateInput} 
                                                onChange={(e) => setEditDateInput(e.target.value)}
                                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-right text-[var(--text-primary)] focus:outline-none"
                                            />
                                            <button onClick={handleDateSave} disabled={submitting} className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--gain-text)]">
                                                <Check size={12} />
                                            </button>
                                            <button onClick={() => setIsEditingDate(false)} disabled={submitting} className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--loss-text)]">
                                                <XCircle size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[var(--text-primary)] font-black">{formattedPlacedDate}</span>
                                            {userRole === 'broker' && !hideOrderDates && (
                                                <button onClick={() => {
                                                    const d = placedDate ? new Date(placedDate) : new Date();
                                                    const pad = (n) => String(n).padStart(2, '0');
                                                    setEditDateInput(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                    setIsEditingDate(true);
                                                }} className="p-0.5 hover:bg-[var(--bg-secondary)] rounded transition-colors">
                                                    <Pencil size={10} className="text-[var(--text-muted)]" />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Expire Date</span>
                                <span className="text-[var(--text-primary)] font-black">{formattedStockExpireDate}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] border-t border-[var(--border-color)] pt-2">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Gross P&L</span>
                                <span className={`font-black ${grossPnl >= 0 ? 'text-[var(--gain-text)]' : 'text-[var(--loss-text)]'}`}>{money(grossPnl)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight">Est. Brokerage (entry)</span>
                                <span className="text-[var(--loss-text)] font-black">-{money(totalBrokerage)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--bg-card)] border-t border-[var(--border-color)] flex flex-col gap-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="flex gap-5">
                    <LockedButtonWrapper featureId="modify_order" className="flex-[1.5]">
                        <button onClick={() => handleAction('Adjust', 'OPEN')} disabled={submitting} className={`w-full py-3.5 rounded-xl text-white font-black text-[11px] uppercase tracking-widest bg-[#089981] shadow-lg shadow-[#089981]/20 ${submitting ? 'opacity-50' : ''}`}>
                            {submitting && action === 'Adjust' ? 'UPDATING...' : (parsedAddLots > 0 ? 'BUY MORE' : 'UPDATE ORDER')}
                        </button>
                    </LockedButtonWrapper>

                    {(userRole === 'broker' || isMarketOpen) && (
                        <LockedButtonWrapper featureId="cancel_order" className="flex-1">
                            <button onClick={() => handleAction('Adjust', 'CLOSED')} disabled={submitting} className={`w-full py-3.5 rounded-xl text-white font-black text-[11px] uppercase tracking-widest bg-[#f23645] shadow-lg shadow-[#f23645]/20 ${submitting ? 'opacity-50' : ''}`}>
                                EXIT
                            </button>
                        </LockedButtonWrapper>
                    )}
                </div>
                {userRole === 'broker' && (
                    <LockedButtonWrapper featureId="modify_order">
                        <button onClick={() => handleAction('Adjust', 'HOLD')} disabled={submitting} className="w-full py-2.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-widest border border-[var(--border-color)]">
                            CONVERT TO HOLD
                        </button>
                    </LockedButtonWrapper>
                )}
            </div>
        </div>
    );
}