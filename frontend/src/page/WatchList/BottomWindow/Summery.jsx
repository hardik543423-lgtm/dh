// Summery.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Hash, Zap, TrendingDown, DollarSign as BidAskIcon } from 'lucide-react';
// *** IMPORT FETCH FUND UTILITY ***
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { logMarketStatus } from '../../../Utils/marketStatus.js'
import LockedButtonWrapper from '../../../components/LockedButtonWrapper';

const DetailRow = ({ Icon, label, value, colorClass = "text-[var(--text-primary)]" }) => (
  <div className="flex justify-between items-center py-1 border-b border-[var(--border-color)] last:border-b-0">
    <div className="flex items-center text-[var(--text-secondary)] text-sm">
      <Icon className="w-4 h-4 mr-2 text-indigo-400" />
      {label}
    </div>
    <span className={`font-medium text-sm ${value === '—' ? 'text-[var(--text-muted)]' : colorClass}`}>
      {value}
    </span>
  </div>
);

function Summery({
  selectedStock,
  sheetData,
  actionTab,
  setActionTab,
  quantity,
  setQuantity,
  orderPrice,
  setOrderPrice,
  placeFakeOrder,
  setSelectedStock,
  productType,
  setProductType,
  ticksRef,
  brokerId,
  customerId,
}) {
  // --- Robust IDs Extraction ---
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

  // ---------- local states ----------
  const [jobbin_price, setJobbin_price] = useState("0");
  const [jobbin_type, setJobbin_type] = useState("percentage"); // "percentage" or "points"
  const [advancedRanges, setAdvancedRanges] = useState([]);
  const [localLotsStr, setLocalLotsStr] = useState('');
  const inputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isOpen = logMarketStatus(selectedStock?.segment);

  // --- Fetch jobbing from DB for this customer on mount ---
  useEffect(() => {
    const fetchJobbing = async () => {
      try {
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
        console.error('[Summery] Failed to fetch jobbing from DB:', err);
      }
    };
    fetchJobbing();

    const handleJobbingUpdate = (e) => {
      try {
        const payload = e.detail;
        if (payload.customer_id === effectiveCustomerId) {
          if (payload.jobbing) {
            setJobbin_price(String(payload.jobbing.price ?? 0.08));
            setJobbin_type(payload.jobbing.type || 'percentage');
          }
        }
      } catch (err) { }
    };

    window.addEventListener('customer_jobbing_updated', handleJobbingUpdate);
    return () => window.removeEventListener('customer_jobbing_updated', handleJobbingUpdate);
  }, [effectiveCustomerId, effectiveBrokerId]);

  // ---------- FRESH DATA HELPER ----------
  // Gets the latest tick data directly from ticksRef (Kite uses instrument_token)
  const getLatestTickData = () => {
    if (!selectedStock || !ticksRef?.current) return null;
    // Kite uses instrument_token as the key
    const key = String(selectedStock.instrument_token);
    return ticksRef.current.get(key) || null;
  };

  // Smart price extraction - handles instruments with only close price
  const extractValidPrice = (data, isBuy = true) => {
    if (!data) return null;
    // Priority 1: LTP (live trading price)
    if (data.ltp != null && data.ltp > 0) return data.ltp;
    // Priority 2: Best Ask (for BUY) or Best Bid (for SELL)
    if (isBuy && data.bestAskPrice != null && data.bestAskPrice > 0) return data.bestAskPrice;
    if (!isBuy && data.bestBidPrice != null && data.bestBidPrice > 0) return data.bestBidPrice;
    // Priority 3: Opposite side bid/ask
    if (isBuy && data.bestBidPrice != null && data.bestBidPrice > 0) return data.bestBidPrice;
    if (!isBuy && data.bestAskPrice != null && data.bestAskPrice > 0) return data.bestAskPrice;
    // Priority 4: Close price (for illiquid instruments)
    if (data.close != null && data.close > 0) return data.close;
    return null;
  };

  // Check if we have ANY valid price data
  const hasValidPriceData = (data) => {
    if (!data) return false;
    return (
      (data.ltp != null && data.ltp > 0) ||
      (data.bestBidPrice != null && data.bestBidPrice > 0) ||
      (data.bestAskPrice != null && data.bestAskPrice > 0) ||
      (data.close != null && data.close > 0)
    );
  };

  // Ensure productType once (Intraday or Overnight)
  useEffect(() => {
    if (!productType) setProductType('Intraday');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selectedStock changes, reset local lots
  useEffect(() => {
    const lotSize = selectedStock?.lot_size || selectedStock?.lotSize || 1;
    if (quantity != null) {
      const n = Number(quantity);
      const lots = Number.isFinite(n) && lotSize > 0 ? Math.floor(n / lotSize) : 0;
      setLocalLotsStr(lots > 0 ? String(lots) : '');
    } else {
      setLocalLotsStr('');
    }
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock]);

  // ---------- market values ----------
  const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
  const bestBidRaw = sheetData?.bestBidPrice != null ? Number(sheetData.bestBidPrice) : null;
  const bestAskRaw = sheetData?.bestAskPrice != null ? Number(sheetData.bestAskPrice) : null;

  const showHigh = sheetData?.high != null ? `₹${Number(sheetData.high).toFixed(2)}` : '—';
  const showLow = sheetData?.low != null ? `₹${Number(sheetData.low).toFixed(2)}` : '—';
  const showClose = sheetData?.close != null ? `₹${Number(sheetData.close).toFixed(2)}` : '—';

  const changeSign = sheetData?.percentChange != null ? (sheetData.percentChange >= 0 ? '▲' : '▼') : '';
  const formattedChangePercent = sheetData?.percentChange != null
    ? `${changeSign} ${Math.abs(Number(sheetData.percentChange)).toFixed(2)}%`
    : '—';

  const getProductTypeClass = (mode) => {
    if (productType !== mode) return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]';
    return actionTab === 'Buy' ? 'bg-[#089981] text-white shadow-lg' : 'bg-[#f23645] text-white shadow-lg';
  };

  // ---------- calculations ----------
  const lotsNum = useMemo(() => {
    const n = Number(localLotsStr);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }, [localLotsStr]);

  const lotSize = selectedStock?.lot_size || selectedStock?.lotSize || 1;
  const qtyNum = useMemo(() => {
    return lotsNum > 0 ? lotsNum * (Number(lotSize) || 1) : 0;
  }, [lotsNum, lotSize]);

  const baseLtp = ltpRaw ?? bestAskRaw ?? bestBidRaw ?? 0;

  const activeJobbing = useMemo(() => {
    const ltpVal = baseLtp || 0;
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
  }, [baseLtp, advancedRanges, jobbin_price, jobbin_type]);

  const isRangeMatched = useMemo(() => {
    const ltpVal = baseLtp || 0;
    return advancedRanges.some(r => ltpVal >= r.start_range && ltpVal <= r.end_range);
  }, [baseLtp, advancedRanges]);

  const jobbinPct = useMemo(() => {
    if (activeJobbing.type === 'points') return 0; // not used in points mode
    const v = parseFloat(String(activeJobbing.price).trim());
    return Number.isFinite(v) ? v / 100 : 0;
  }, [activeJobbing]);

  const jobbinPoints = useMemo(() => {
    if (activeJobbing.type !== 'points') return 0;
    const v = parseFloat(String(activeJobbing.price).trim());
    return Number.isFinite(v) ? v : 0;
  }, [activeJobbing]);

  const { adjustedPricePerShareRaw, adjustedPricePerShare } = useMemo(() => {
    if (!baseLtp) return { adjustedPricePerShareRaw: 0, adjustedPricePerShare: 0 };
    let pxRaw;
    if (activeJobbing.type === 'points') {
      // Points mode: directly add/subtract the fixed amount
      pxRaw = actionTab === 'Buy' ? (baseLtp + jobbinPoints) : (baseLtp - jobbinPoints);
    } else {
      // Percentage mode: existing behavior
      const perShareFactor = actionTab === 'Buy' ? (1 + jobbinPct) : (1 - jobbinPct);
      pxRaw = baseLtp * perShareFactor;
    }
    return { adjustedPricePerShareRaw: pxRaw, adjustedPricePerShare: Number(pxRaw.toFixed(4)) };
  }, [baseLtp, actionTab, jobbinPct, jobbinPoints, activeJobbing.type]);

  const totalOrderValue = useMemo(() => {
    if (!adjustedPricePerShare || !qtyNum) return 0;
    return Number((adjustedPricePerShare * qtyNum).toFixed(2));
  }, [adjustedPricePerShare, qtyNum]);

  useEffect(() => {
    if (totalOrderValue > 0) setOrderPrice(String(totalOrderValue));
    else setOrderPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOrderValue]);

  // ---------- handlers ----------
  const handleInputChange = (e) => {
    const v = e.target.value;
    setLocalLotsStr(v);
    setFeedback(null);
  };

  const propagateQtyToParent = () => {
    const rawLots = (localLotsStr || (inputRef.current && inputRef.current.value) || '').toString().trim();
    const n = parseInt(rawLots, 10);
    const lots = Number.isFinite(n) && n > 0 ? n : 0;
    const totalShares = lots > 0 ? String(lots * (Number(lotSize) || 1)) : '';
    setQuantity && setQuantity(totalShares);
  };

  const handleQtyBlur = () => {
    propagateQtyToParent();
  };


  // *** MAIN ORDER HANDLER ***
  const handleConfirm = async () => {
    setSubmitting(true);
    setFeedback(null);

    propagateQtyToParent();

    const rawLots = (localLotsStr || (inputRef.current && inputRef.current.value) || '').toString().trim();
    const parsedLots = parseInt(rawLots, 10);
    const lots = Number.isFinite(parsedLots) && parsedLots > 0 ? parsedLots : 0;

    // 1. Basic Input Validation
    if (!lots) {
      setFeedback({ type: 'error', message: 'Please enter a valid lot count.' });
      setSubmitting(false);
      return;
    }

    // *** CRITICAL: Get FRESH price from ticksRef at this exact moment ***
    const isBuy = actionTab === 'Buy';
    const latestTickData = getLatestTickData();
    const freshPrice = extractValidPrice(latestTickData, isBuy);

    // Smart validation - only block if we have NO valid price data at all
    if (freshPrice === null) {
      // Check sheetData as fallback (from React state)
      const fallbackPrice = extractValidPrice(sheetData, isBuy);
      if (fallbackPrice === null) {
        setFeedback({ type: 'error', message: 'Unable to fetch price. Please wait a moment and try again.' });
        setSubmitting(false);
        return;
      }
    }

    // Use fresh price if available, otherwise fallback to displayed price
    const priceForOrder = freshPrice ?? extractValidPrice(sheetData, isBuy) ?? 0;

    // Props brokerId and customerId are used directly

    const side = isBuy ? 'BUY' : 'SELL';
    const product = productType === 'Intraday' ? 'MIS' : 'NRML';
    const lot_size = selectedStock?.lot_size || selectedStock?.lotSize || 1;
    const qty = Number(lots) * Number(lot_size);

    // Calculate final price with jobbin adjustment using FRESH price
    const orderMatch = advancedRanges.find(r => priceForOrder >= r.start_range && priceForOrder <= r.end_range);
    const orderJobbingPrice = orderMatch ? String(orderMatch.jobbing_value) : jobbin_price;
    const orderJobbingType = orderMatch ? orderMatch.jobbing_type : jobbin_type;
    const orderJobbingPct = orderJobbingType === 'percentage' ? (parseFloat(orderJobbingPrice) || 0) / 100 : 0;
    const orderJobbingPoints = orderJobbingType === 'points' ? (parseFloat(orderJobbingPrice) || 0) : 0;

    let finalPrice;
    if (orderJobbingType === 'points') {
      finalPrice = Number((isBuy ? (priceForOrder + orderJobbingPoints) : (priceForOrder - orderJobbingPoints)).toFixed(4));
    } else {
      const jobbinFactor = isBuy ? (1 + orderJobbingPct) : (1 - orderJobbingPct);
      finalPrice = Number((priceForOrder * jobbinFactor).toFixed(4));
    }
    if (finalPrice <= 0) {
      setFeedback({ type: 'error', message: 'Price / Share cannot be zero or negative. Please adjust your jobbing point.' });
      setSubmitting(false);
      return;
    }
    const calculatedOrderValue = Number((finalPrice * qty).toFixed(2));

    // *** 2. FUND VALIDATION LOGIC ***
    try {
      // Calculate Total Required Amount for this Order (using fresh calculated value)
      const requiredAmount = calculatedOrderValue;

      // Fetch Latest Funds from Backend
      const fundsData = await getFundsData();

      if (!fundsData) {
        throw new Error("Unable to fetch wallet balance.");
      }

      let availableLimit = 0;
      let limitType = "";

      if (productType === 'Intraday') {
        // Intraday Free Limit = Available - Used
        const maxLimit = fundsData.intraday?.available_limit || 0;
        const usedLimit = fundsData.intraday?.used_limit || 0;
        availableLimit = maxLimit - usedLimit;
        limitType = "Intraday";
      } else {
        // Overnight Free Limit = Available - Used
        const maxLimit = fundsData.overnight?.available_limit || 0;
        const usedLimit = fundsData.overnight?.used_limit || 0;
        availableLimit = maxLimit - usedLimit;
        limitType = "Overnight";
      }

      // Check Logic
      if (requiredAmount > availableLimit) {
        // *** NOT ENOUGH BALANCE - RED TOAST ***
        setFeedback({
          type: 'error',
          message: `Insufficient ${limitType} Balance! Required: ₹${requiredAmount}, Available: ₹${availableLimit.toFixed(2)}. Add funds.`
        });
        setSubmitting(false);
        return; // Stop execution here
      }

    } catch (err) {
      console.error("Fund validation error:", err);
      setFeedback({ type: 'error', message: "Failed to validate funds. Try again." });
      setSubmitting(false);
      return;
    }

    // *** 3. PROCEED TO PLACE ORDER (If Funds OK) ***
    const payload = {
      broker_id_str: effectiveBrokerId,
      customer_id_str: effectiveCustomerId,
      instrument_token: selectedStock?.instrument_token || '',
      symbol: selectedStock?.tradingSymbol || '',
      segment: selectedStock?.segment || '',
      side,
      product,
      price: Number(finalPrice),
      quantity: qty,
      lots: Number(lots),
      lot_size: Number(lot_size),
      jobbin_price: (orderJobbingPrice === '' || orderJobbingPrice === undefined || orderJobbingPrice === null) ? 0 : Number(orderJobbingPrice),
      jobbin_type: orderJobbingType,
      expire: selectedStock?.expiry || new Date().toLocaleString('en-IN'),
      meta: { from: 'ui_watchlist_summery', selectedStock }
    };

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    try {
      const res = await fetch(`${apiBase}/api/orders/postOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }

      if (!res.ok || (body && body.success === false)) {
        const message = body?.error || body?.message || `Server responded with ${res.status}`;
        throw new Error(message);
      }

      console.log('Order successful:', body);
      // *** GREEN SUCCESS TOAST ***
      setFeedback({ type: 'success', message: 'Order placed successfully!' });

      setTimeout(() => {
        setSelectedStock && setSelectedStock(null);
      }, 1500);

    } catch (err) {
      console.error('Order submission failed', err);
      setFeedback({ type: 'error', message: `Order failed: ${String(err.message || err)}` });

    } finally {
      setSubmitting(false);
    }
  };
  const userRole = userObject.role;

  // Use an input key so React will remount the input only when selectedStock changes.
  const qtyInputKey = selectedStock ? (selectedStock.instrument_token ?? selectedStock.symbol ?? JSON.stringify(selectedStock)) : 'qty-global';

  const formattedCMP = baseLtp ? baseLtp.toFixed(2) : '—';

  return (
    <div className="flex flex-col h-full bg-[#131722] text-[#b2b5be] font-sans overflow-hidden">
      {/* Mini Header */}
      <div className="px-4 py-4 bg-[#1e222d]/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-2xl font-black text-white">₹{formattedCMP}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sheetData?.isPositive === true ? "bg-[#089981]/20 text-[#089981]" :
            sheetData?.isPositive === false ? "bg-[#f23645]/20 text-[#f23645]" : "bg-[#808a9d]/20 text-[#808a9d]"
            }`}>
            {formattedChangePercent}
          </span>
        </div>
        <p className="text-[9px] font-bold text-[#808a9d] uppercase tracking-tighter opacity-40">Live Price</p>
      </div>

      {/* Compact Toggles */}
      <div className="flex gap-2 px-4 mb-3">
        <button
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all ${actionTab === 'Buy'
            ? 'border-[#4f46e5] bg-[#4f46e5]/10 text-[#a5b4fc]' : 'border-[#2a2e39] text-[#808a9d] bg-[#1e222d]'}`}
          onClick={() => setActionTab('Buy')}
        >BUY</button>
        {!(userRole === 'customer' && (selectedStock?.segment?.includes('FUT') || selectedStock?.segment?.includes('OPT'))) && (
          <button
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all ${actionTab === 'Sell'
              ? 'border-[#f23645] bg-[#f23645]/10 text-[#fca5a5]' : 'border-[#2a2e39] text-[#808a9d] bg-[#1e222d]'}`}
            onClick={() => setActionTab('Sell')}
          >SELL</button>
        )}
      </div>

      <div className="px-4 mb-4">
        <div className="flex bg-[#1e222d] rounded-xl p-1 border border-[#2a2e39]">
          <button className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productType === 'Intraday' ? 'bg-[#2a2e39] text-white' : 'text-[#808a9d]'}`} onClick={() => setProductType('Intraday')}>INTRADAY</button>
          <button className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productType === 'Overnight' ? 'bg-[#2a2e39] text-white' : 'text-[#808a9d]'}`} onClick={() => setProductType('Overnight')}>OVERNIGHT</button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        {feedback && (
          <div className={`p-2 mb-3 rounded-lg text-[11px] font-bold text-center ${feedback.type === 'error' ? 'bg-[#f23645]/10 text-[#fca5a5]' : 'bg-[#089981]/10 text-[#a5f3e0]'}`}>
            {feedback.message}
          </div>
        )}

        {/* Compact Quantity Card */}
        <div className="mb-3 bg-[#1e222d] p-4 rounded-2xl border border-[#2a2e39] relative">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-black text-[#808a9d] uppercase tracking-wider">Qty (Lots)</span>
            <span className="text-[8px] font-bold text-white/30 bg-white/5 px-1.5 py-0.2 rounded-full">Lot: {lotSize}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => { setLocalLotsStr(String(Math.max(0, (Number(localLotsStr) || 0) - 1))); setFeedback(null); }} className="w-10 h-10 rounded-xl bg-[#2a2e39] border border-[#363a45] text-white flex items-center justify-center shadow-sm active:scale-90"><TrendingDown size={16} /></button>
            <div className="flex-1 flex flex-col items-center">
              <input key={qtyInputKey} ref={inputRef} value={localLotsStr} type="number" onChange={handleInputChange} onBlur={handleQtyBlur} className="bg-transparent text-center text-4xl font-black text-white w-full outline-none" placeholder="0" />
              <span className="text-[8px] font-bold text-[#808a9d] mt-1 uppercase">Total: {qtyNum}</span>
            </div>
            <button onClick={() => { setLocalLotsStr(String((Number(localLotsStr) || 0) + 1)); setFeedback(null); }} className="w-10 h-10 rounded-xl bg-[#2a2e39] border border-[#363a45] text-white flex items-center justify-center shadow-sm active:scale-90"><TrendingUp size={16} /></button>
          </div>
        </div>

        {/* Compact Jobbing */}
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

        {/* Value Dashboard */}
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

      {/* Mini Footer */}
      <div className="p-4 bg-[#1e222d] border-t border-[#2a2e39] flex gap-3">
        {(userRole === 'broker' || isOpen) && (
          <LockedButtonWrapper featureId={actionTab === 'Buy' ? 'buy' : 'sell'} className="flex-[2]">
            <button onClick={handleConfirm} disabled={submitting || adjustedPricePerShare <= 0} className={`w-full py-3.5 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 ${actionTab === 'Buy' ? 'bg-[#089981]' : 'bg-[#f23645]'} ${submitting || adjustedPricePerShare <= 0 ? 'opacity-50' : ''}`}>
              {submitting ? '...' : `${actionTab}`}
            </button>
          </LockedButtonWrapper>
        )}
        <button onClick={() => setSelectedStock(null)} className="flex-1 py-3.5 rounded-xl bg-[#2a2e39] text-[#808a9d] font-bold text-[10px] uppercase transition-colors hover:text-white">Close</button>
      </div>
    </div>
  );
}

export default Summery;