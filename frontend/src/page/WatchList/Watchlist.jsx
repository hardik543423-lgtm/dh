import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search, Trash2, Settings, X, Percent, Filter } from "lucide-react";
import BottomWindow from "./BottomWindow/BottomWindow";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";
import { usePermissions } from "../../contexts/PermissionsContext.jsx";
import LockedButtonWrapper from "../../components/LockedButtonWrapper";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import Toast from '../../Utils/Toast.jsx'
import { logMarketStatus } from '../../Utils/marketStatus';
import RiskDisclosureModal from './RiskDisclosureModal';


import { formatTradingSymbol } from "../../Utils/calculateBrokerage.jsx";

// --- Index Card (Matches image) ---
const IndexCard = ({ name, price, change, onClick }) => {
  const [flashColor, setFlashColor] = useState("");
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (!price || price === "—" || price === "--") return;

    const currentP = parseFloat(price);
    const prevP = parseFloat(prevPriceRef.current);

    if (!isNaN(currentP) && !isNaN(prevP) && currentP !== prevP) {
      if (currentP > prevP) {
        setFlashColor("text-[#089981]"); // Green flash for price up
      } else {
        setFlashColor("text-[#f23645]"); // Red flash for price down
      }
      const timer = setTimeout(() => {
        setFlashColor(""); // Reset flash after 500ms
      }, 500);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    } else {
      prevPriceRef.current = price;
    }
  }, [price]);

  const valP = parseFloat(price) || 0;
  const valC = parseFloat(change) || 0;
  const netC = (valP * valC) / 100;
  const isPositive = valC >= 0;

  const defaultColor = isPositive ? "text-[#089981]" : "text-[#f23645]";
  const priceColor = flashColor || "text-white";

  const numC = Number(change);
  const formattedChange = (price === "—" || price === "--" || isNaN(numC))
    ? "+0.00 (+0.00%)"
    : `${isPositive ? '+' : ''}${netC.toFixed(2)} (${isPositive ? '+' : ''}${numC.toFixed(2)}%)`;

  return (
    <div
      className="flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3.5 py-2.5 rounded-lg mx-1 flex flex-col justify-between shadow-sm cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
      style={{ width: '164px', height: '62px' }}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[13px] font-bold text-[var(--text-primary)] uppercase truncate pr-1">{name}</span>
        <span className={`text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ${priceColor === 'text-white' ? 'text-[var(--text-primary)]' : priceColor}`}>
          {price}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-[var(--text-muted)] font-medium">NSE</span>
        <span className={`text-[10.5px] font-medium whitespace-nowrap ${defaultColor}`}>
          {formattedChange}
        </span>
      </div>
    </div>
  );
};

// --- Swipeable Watchlist Item ---
const SwipeableWatchlistItem = ({
  item, priceData, isExpanded, onClick, onRemove, onBuy, onSell, onChart, onOptionChain, onMarketDepth
}) => {
  // Destructure price data
  const { ltp, netChange, percentChange, isPositive, volume, close, open, high, low } = priceData;

  // Neutral text colors - no more vibrant green/red
  const formattedPrice = ltp == null ? "—" : `₹${Number(ltp).toFixed(2)}`;
  const formattedNetChange = netChange == null ? "—" : `${netChange > 0 ? "+" : ""}${Number(netChange).toFixed(2)}`;
  const formattedPercentChange = percentChange == null ? "—" : `(${percentChange > 0 ? "+" : ""}${Number(percentChange).toFixed(2)}%)`;
  const formattedVolume = volume ? `${(Number(volume) / 100000).toFixed(2)}L` : "—";
  const formattedClose = close ? `Close: ₹${Number(close).toFixed(2)}` : "";

  // OHLC formatted
  const formattedOpen = open != null ? Number(open).toFixed(2) : "—";
  const formattedHigh = high != null ? Number(high).toFixed(2) : "—";
  const formattedLow = low != null ? Number(low).toFixed(2) : "—";
  const formattedCloseVal = close != null ? Number(close).toFixed(2) : "—";

  // Tinted chip background for gain/loss indication
  const chipBg = isPositive === true
    ? "bg-[var(--gain-chip-bg)]"
    : isPositive === false
      ? "bg-[var(--loss-chip-bg)]"
      : "bg-transparent";

  // Text color for % change and net change (green/red)
  const pnlTextColor = isPositive === true
    ? "text-[var(--gain-text)]"
    : isPositive === false
      ? "text-[var(--loss-text)]"
      : "text-[var(--text-secondary)]";

  // Arrow indicator
  const arrow = isPositive === true ? "▲" : isPositive === false ? "▼" : "";

  // Motion values for swipe effect
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, -50], [1, 0]); // Fade icon based on drag
  const bgOpacity = useTransform(x, [-100, 0], [1, 0]); // Background redness

  // Check user role for F&O sell restriction
  const userString = typeof window !== 'undefined' ? localStorage.getItem('loggedInUser') : null;
  const userRole = userString ? JSON.parse(userString).role : '';
  const isCustomer = userRole === 'customer';
  const isFnO = item?.segment?.includes('OPT') || item?.instrument_type === 'CE' || item?.instrument_type === 'PE';

  return (
    <div className="relative overflow-hidden">
      {/* Background Layer (Red with Delete Icon) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-y-0 right-0 w-full bg-red-600/20 flex items-center justify-end pr-6 z-0"
      >
        <Trash2 className="text-red-500 w-6 h-6" />
      </motion.div>

      {/* Foreground Layer (The Actual Item) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={(e, { offset, velocity }) => {
          if (offset.x < -100) {
            onRemove(item);
          }
        }}
        whileTap={{ cursor: "grabbing" }}
        style={{ x, backgroundColor: "var(--bg-secondary)" }}
        className={`relative z-10 py-3 px-4 transition-colors cursor-pointer border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)]`}
        onClick={() => {
          if (x.get() === 0) onClick();
        }}
      >
        {/* Main Row */}
        <div className="flex justify-between items-center w-full pointer-events-none pb-0.5">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-sm text-[var(--text-primary)] block truncate">
                {item.name || item.tradingSymbol.replace(/[0-9].*$/, '')}
              </span>
              {/* Optional tag based on segment/type */}
              {item.instrument_type && (
                <span className="text-[9px] font-semibold uppercase px-[4px] py-[2px] rounded-[3px] bg-[#d28a30]/15 text-[#d28a30] leading-[10px]">
                  {item.instrument_type}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#787b86] dark:text-[#787b86] block truncate font-medium">
              {formatTradingSymbol(item.tradingSymbol)} • {item.exchange}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`font-semibold tabular-nums text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-[#089981]' : (isPositive === false ? 'text-[#f23645]' : 'text-[var(--text-secondary)]')}`}>
              {formattedPrice} {arrow && <span className="text-[9px] mb-[1px]">{arrow}</span>}
            </div>
            <div className="text-[10px] tabular-nums text-[var(--text-secondary)] mt-0.5 font-medium">
              {formattedNetChange} {formattedPercentChange}
            </div>
          </div>
        </div>

        {/* Expanded Section - OHLC + Buy/Sell + Quick Actions */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
                opacity: { duration: 0.2, delay: 0.05 }
              }}
              className="overflow-hidden pointer-events-auto"
            >
              {/* OHLC Grid */}
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[var(--border-color)]/50">
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Open</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formattedOpen}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">High</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formattedHigh}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Low</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formattedLow}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Close</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formattedCloseVal}</span>
                </div>
              </div>

              {/* Buy / Sell Buttons */}
              <div className="flex gap-3 mt-3">
                <LockedButtonWrapper featureId="buy" className="flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onBuy(); }}
                    className="w-full py-2.5 rounded-lg bg-[#089981] hover:brightness-90 text-white font-bold text-sm tracking-wide transition-all duration-150 active:scale-[0.97]"
                  >
                    BUY
                  </button>
                </LockedButtonWrapper>
                {!(isCustomer && isFnO) && (
                  <LockedButtonWrapper featureId="sell" className="flex-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSell(); }}
                      className="w-full py-2.5 rounded-lg bg-[#f23645] hover:brightness-90 text-white font-bold text-sm tracking-wide transition-all duration-150 active:scale-[0.97]"
                    >
                      SELL
                    </button>
                  </LockedButtonWrapper>
                )}
              </div>

              {/* Quick Action Icons Row */}
              <div className="flex items-center justify-around mt-3 pt-3 border-t border-[var(--border-color)]/50">
                {/* Chart */}
                <button
                  onClick={(e) => { e.stopPropagation(); onChart?.(); }}
                  className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition group"
                  title="Chart"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-indigo-400 transition-colors"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                  <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Chart</span>
                </button>

                {/* Option Chain */}
                <button
                  onClick={(e) => { e.stopPropagation(); onOptionChain?.(); }}
                  className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition group"
                  title="Option Chain"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-indigo-400 transition-colors"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                  <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] whitespace-nowrap">Option Chain</span>
                </button>

                {/* Market Depth */}
                <button
                  onClick={(e) => { e.stopPropagation(); onMarketDepth?.(); }}
                  className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition group"
                  title="Market Depth"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-indigo-400 transition-colors"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>
                  <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] whitespace-nowrap">Market Depth</span>
                </button>

                {/* Remove */}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                  className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-red-500/10 transition group"
                  title="Remove"
                >
                  <Trash2 className="w-[18px] h-[18px] text-[var(--text-secondary)] group-hover:text-red-400 transition-colors" />
                  <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-red-400">Remove</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

function Watchlist() {
  const { refreshPermissions } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    refreshPermissions();
  }, []);


  const [searchParams] = useSearchParams();
  const brokerId = searchParams.get("brokerId");
  const customerId = searchParams.get("customerId");

  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || null;
  const { ticksRef, subscribe, unsubscribe, isConnected } = useMarketData();
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const [stocks, setStocks] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [actionTab, setActionTab] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState("");
  const [indexInstruments, setIndexInstruments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const openedInstrumentRef = useRef(null);
  const isUpgradingRef = useRef(false);

  // *** Expanded Stock State (inline expand on click) ***
  const [expandedStockId, setExpandedStockId] = useState(null);
  const [bottomWindowMode, setBottomWindowMode] = useState('Order');

  // *** Filter State ***
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // *** Watchlists State ***
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState(() => {
    return localStorage.getItem('lastActiveWatchlistName') || '';
  });

  // New Watchlist Modal State
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");

  // Handle switching active watchlist tabs dynamically
  const switchWatchlist = (name) => {
    setActiveWatchlist(name);
    const selectedList = watchlists.find(wl => wl.name === name);
    if (selectedList) {
      const instrumentsArr = selectedList.instruments || [];
      const formattedWatchlist = formatInstruments ? formatInstruments(instrumentsArr) : instrumentsArr;
      const uniqueWatchlist = Array.from(new Map(formattedWatchlist.map(item => [item.id ?? item._id ?? item.instrument_token, item])).values());
      setStocks(uniqueWatchlist);
    }
  };

  // *** Option Limit Settings State (Broker) ***
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInput, setLimitInput] = useState("10");
  const [savingLimit, setSavingLimit] = useState(false);

  // *** Jobbing Settings State (Broker) - FROM DATABASE ***
  const [showJobbingModal, setShowJobbingModal] = useState(false);
  const [jobbingType, setJobbingType] = useState('percentage');
  const [jobbingValue, setJobbingValue] = useState('0.08');

  // Helper to get active context
  const getActiveContext = () => {
    try {
      const userString = localStorage.getItem('loggedInUser');
      const userObject = userString ? JSON.parse(userString) : {};

      if (userObject.role === 'customer') {
        const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
        return {
          brokerId: globalBrokerId,
          customerId: userObject.id
        };
      }

      const raw = localStorage.getItem('activeContext');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        brokerId: brokerId || parsed.brokerId,
        customerId: customerId || parsed.customerId
      };
    } catch {
      return { brokerId, customerId };
    }
  };

  // Sync URL params to localStorage for other components that might need them
  useEffect(() => {
    if (brokerId || customerId) {
      const existing = JSON.parse(localStorage.getItem('activeContext') || '{}');
      const updated = {
        brokerId: brokerId || existing.brokerId,
        customerId: customerId || existing.customerId
      };
      if (updated.brokerId !== existing.brokerId || updated.customerId !== existing.customerId) {
        localStorage.setItem('activeContext', JSON.stringify(updated));
      }
    }
  }, [brokerId, customerId]);

  // Sync active watchlist to local storage for SearchPage consistency
  useEffect(() => {
    if (activeWatchlist) {
      localStorage.setItem('lastActiveWatchlistName', activeWatchlist);
    }
  }, [activeWatchlist]);

  const handleSaveJobbing = async () => {
    const val = parseFloat(jobbingValue);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid jobbing value', 'error');
      return;
    }

    setSavingLimit(true);
    try {
      const ctx = getActiveContext();
      // 1. Save to per-customer Fund document (primary)
      const fundResponse = await fetch(`${apiBase}/api/funds/updateCustomerJobbing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broker_id_str: ctx.brokerId,
          customer_id_str: ctx.customerId,
          price: val,
          type: jobbingType
        })
      });

      const fundData = await fundResponse.json();
      if (!fundResponse.ok || !fundData.success) {
        throw new Error(fundData.message || "Failed to save jobbing to database");
      }

      // 2. Clear Broker Default Update (Removed to isolate customer settings)

      showToast(`Jobbing set to ${val} ${jobbingType === 'percentage' ? '%' : '₹'} and saved!`, 'success');
      setShowJobbingModal(false);
    } catch (err) {
      console.error('[Jobbing Save] Error:', err);
      showToast(err.message || 'Failed to save jobbing', 'error');
    } finally {
      setSavingLimit(false);
    }
  };

  const handleClearJobbing = async () => {
    setSavingLimit(true);
    try {
      const ctx = getActiveContext();
      // Reset to defaults in per-customer Fund document
      const response = await fetch(`${apiBase}/api/funds/updateCustomerJobbing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broker_id_str: ctx.brokerId,
          customer_id_str: ctx.customerId,
          price: 0.08,
          type: 'percentage'
        })
      });

      if (!response.ok) throw new Error("Failed to clear jobbing in database");

      setJobbingType('percentage');
      setJobbingValue('0.08');
      showToast('Jobbing reset to default (0.08%)', 'success');
      setShowJobbingModal(false);
    } catch (err) {
      console.error('[Jobbing Clear] Error:', err);
      showToast(err.message || 'Failed to clear jobbing in database', 'error');
    } finally {
      setSavingLimit(false);
    }
  };

  const handleSaveLimit = async () => {
    if (!limitInput || isNaN(limitInput) || Number(limitInput) <= 0 || Number(limitInput) > 100) {
      showToast("Please enter a valid percentage (1-100)", "error");
      return;
    }

    setSavingLimit(true);
    try {
      const activeContextString = localStorage.getItem('activeContext');
      const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
      const brokerId = activeContext.brokerId;
      const customerId = activeContext.customerId;

      const res = await fetch(`${apiBase}/api/funds/updateOptionLimitPercentage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          broker_id_str: brokerId,
          customer_id_str: customerId,
          percentage: limitInput
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update limit");
      }

      showToast(`Option limit updated to ${limitInput}%`, "success");
      setShowLimitModal(false);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update limit", "error");
    } finally {
      setSavingLimit(false);
    }
  };

  // *** Toast State ***
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });

  const showToast = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 2500); // 2.5s fast toast
  };

  useEffect(() => {
    logMarketStatus();
  }, []);

  // Helper function to get proper exchange display name based on Kite segment and instrument type
  const getExchangeDisplayName = (segment, instrument_type) => {
    // Kite segments: NFO-FUT, NFO-OPT, BFO-FUT, BFO-OPT, MCX-FUT, MCX-OPT, NSE, BSE, INDICES
    if (segment === 'INDICES') return 'Index';
    if (segment === 'EQ') return 'NSE Equity';
    if (segment === 'EQ') return 'BSE Equity';
    if (segment === 'NFO-FUT') return 'NSE Futures';
    if (segment === 'NFO-OPT') return 'NSE Options';
    if (segment === 'BFO-FUT') return 'BSE Futures';
    if (segment === 'BFO-OPT') return 'BSE Options';
    if (segment === 'MCX-FUT') return 'MCX Futures';
    if (segment === 'MCX-OPT') return 'MCX Options';
    if (segment === 'CDS-FUT') return 'Currency Futures';
    if (segment === 'CDS-OPT') return 'Currency Options';
    // Fallback based on instrument_type
    if (instrument_type === 'FUT') return 'Futures';
    if (['CE', 'PE'].includes(instrument_type)) return 'Options';
    return segment || 'Unknown';
  };

  // Format instruments using Kite schema
  const formatInstruments = (instruments) => {
    if (!Array.isArray(instruments)) return [];

    // Debug: Log first item to see what fields are coming from backend
    if (instruments.length > 0) {
      console.log('[Watchlist] Raw instrument sample:', JSON.stringify(instruments[0], null, 2));
    }

    return instruments
      .filter(one => one && one.instrument_token) // Filter out items without instrument_token
      .map(one => ({
        id: String(one.instrument_token),
        instrument_token: String(one.instrument_token),
        tradingSymbol: one.tradingsymbol || one.name || "Unknown",
        name: one.name || one.tradingsymbol || "Unknown",
        exchange: getExchangeDisplayName(one.segment, one.instrument_type),
        segment: one.segment,
        instrument_type: one.instrument_type || null,
        expiry: one.expiry || null,
        strike: one.strike || null,
        lot_size: one.lot_size ?? 1,
        tick_size: one.tick_size ?? 0.05,
        canon_key: one.canon_key,
      }));
  };

  // Subscribe and snapshot using Kite instrument_token
  const subscribeAndSnapshot = useCallback(async (instrumentList, subscriptionType = 'full') => {
    if (!instrumentList || instrumentList.length === 0) return;
    const subs = instrumentList.map(p => ({ instrument_token: p.instrument_token }));
    try { await subscribe(subs, subscriptionType); } catch (e) { console.warn(e); }

    // Small delay to allow first WebSocket tick to arrive before snapshot
    await new Promise(r => setTimeout(r, 50));

    try {
      const r = await fetch(`${apiBase}/api/quotes/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ items: subs }),
      });
      const map = r.ok ? await r.json() : {};
      console.log('[Watchlist] Snapshot response keys:', Object.keys(map));
      if (Object.keys(map).length > 0) {
        const firstKey = Object.keys(map).find(k => k !== '__snapshot_info');
        if (firstKey) console.log('[Watchlist] Snapshot sample:', firstKey, map[firstKey]);
      }
      setSnapshots(prev => ({ ...prev, ...map }));
    } catch (e) { console.warn(e); }
  }, [subscribe, apiBase, token]);

  // Upgrade/Downgrade logic removed as per request - Watchlist now defaults to 'full' mode
  // The selectedStock state now just tracks which item is open in bottom window



  // *** REMOVE FUNCTION (Optimistic UI) - Kite format ***
  const handleRemoveFromWatchlist = useCallback(async (stock) => {
    if (!stock || !stock.instrument_token) return;

    // 1. Immediately remove from UI (Optimistic Update)
    setStocks(prev => prev.filter(s => s.id !== stock.id));

    // 2. Show Toast Immediately
    showToast(`Stock removed successfully`, "success");

    // 3. Close bottom window if selected
    if (selectedStock?.id === stock.id) setSelectedStock(null);

    // 4. Perform API Call in Background & Invalidate Cache
    try {
      const activeContextString = localStorage.getItem('activeContext');
      const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
      const brokerId = activeContext.brokerId;
      const customerId = activeContext.customerId;

      // Invalidate context-specific caches!
      const cacheKeySuffix = `_${brokerId}_${customerId}`;
      sessionStorage.removeItem(`watchlist_cache${cacheKeySuffix}`);
      sessionStorage.removeItem(`watchlist_cache_time${cacheKeySuffix}`);
      sessionStorage.removeItem(`watchlists_meta${cacheKeySuffix}`);

      const canonKey = stock.canon_key || `${stock.segment}|${stock.tradingSymbol}`;

      // Also update the global watchlists state so switching tabs doesn't restore it
      setWatchlists(prevLists => prevLists.map(list => {
        if ((list.name || 'Main Watchlist') === activeWatchlist || list.name === activeWatchlist) {
          return {
            ...list,
            instruments: (list.instruments || []).filter(inst => {
              const instId = inst.id ?? inst._id ?? inst.instrument_token;
              return String(instId) !== String(stock.id);
            })
          };
        }
        return list;
      }));

      const response = await fetch(
        `${apiBase}/api/watchlist/${encodeURIComponent(canonKey)}?broker_id_str=${brokerId}&customer_id_str=${customerId}&name=${encodeURIComponent(activeWatchlist)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Subscriptions now default to 'full' mode for Watchlist
      const sub = [{ instrument_token: stock.instrument_token }];
      unsubscribe(sub, 'full').catch(console.warn);

      if (!response.ok) {
        console.error("API failed to remove, but UI updated.");
      }
    } catch (error) {
      console.error("Failed to remove from watchlist:", error);
    }
  }, [apiBase, token, unsubscribe, selectedStock, activeWatchlist]);

  // *** Delete ENTIRE Watchlist Route ***
  const handleDeleteWatchlist = async (nameToDelete) => {
    // Cannot delete if there's only one list
    if (watchlists.length <= 1) {
      showToast("Cannot delete the last watchlist.", "error");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete '${nameToDelete}'?`);
    if (!confirmDelete) return;

    try {
      const activeContextString = localStorage.getItem('activeContext');
      const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
      const brokerId = activeContext.brokerId;
      const customerId = activeContext.customerId;

      const response = await fetch(`${apiBase}/api/watchlist/delete/list?broker_id_str=${brokerId}&customer_id_str=${customerId}&name=${encodeURIComponent(nameToDelete)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        showToast(`Watchlist deleted`, "success");

        // Remove from UI
        const updatedLists = watchlists.filter((wl) => (wl.name || 'Main Watchlist') !== nameToDelete);
        setWatchlists(updatedLists);

        // If we deleted the active watchlist, switch to the first available watchlist
        if (activeWatchlist === nameToDelete && updatedLists.length > 0) {
          const newActive = updatedLists[0].name || 'Main Watchlist';
          switchWatchlist(newActive);
        }

        // Clear context-specific cache
        const cacheKeySuffix = `_${brokerId}_${customerId}`;
        sessionStorage.removeItem(`watchlist_cache${cacheKeySuffix}`);
        sessionStorage.removeItem(`watchlist_cache_time${cacheKeySuffix}`);
        sessionStorage.removeItem(`watchlists_meta${cacheKeySuffix}`);
      } else {
        const errorData = await response.json();
        showToast(errorData.message || "Failed to delete watchlist", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error deleting watchlist", "error");
    }
  };


  // ... (Initial load useEffect - OPTIMIZED WITH CACHING)
  useEffect(() => {
    if (!isConnected || loadingRef.current) return;
    loadingRef.current = true;

    const loadAllInstruments = async () => {
      const startTime = performance.now();
      console.log('[Watchlist Load] Starting...');

      try {
        setIsLoading(true);

        const activeContextString = localStorage.getItem('activeContext');
        const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
        const brokerId = activeContext.brokerId;
        const customerId = activeContext.customerId;

        if (!brokerId || !customerId) {
          console.warn('[Watchlist Load] Missing context, skipping load');
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }

        // Try to get cached data first (Context-specific)
        const cacheKeySuffix = `_${brokerId}_${customerId}`;
        const cachedWatchlist = sessionStorage.getItem(`watchlist_cache${cacheKeySuffix}`);
        const cachedIndexes = sessionStorage.getItem(`indexes_cache${cacheKeySuffix}`);
        const cachedWatchlistsMeta = sessionStorage.getItem(`watchlists_meta${cacheKeySuffix}`);
        const cacheTime = sessionStorage.getItem(`watchlist_cache_time${cacheKeySuffix}`);
        const now = Date.now();
        const CACHE_TTL = 30 * 1000; // 30 seconds for faster debugging

        if (cachedWatchlist && cachedIndexes && cacheTime && (now - parseInt(cacheTime)) < CACHE_TTL) {
          console.log('[Watchlist Load] Using cached data for context:', cacheKeySuffix);
          const formattedIndexes = JSON.parse(cachedIndexes);
          const uniqueWatchlist = JSON.parse(cachedWatchlist);

          if (cachedWatchlistsMeta) {
            setWatchlists(JSON.parse(cachedWatchlistsMeta));
          }

          setIndexInstruments(formattedIndexes);
          setStocks(uniqueWatchlist);

          if (formattedIndexes.length > 0) subscribeAndSnapshot(formattedIndexes, 'full');
          if (uniqueWatchlist.length > 0) subscribeAndSnapshot(uniqueWatchlist, 'full');

          setIsLoading(false);
          loadingRef.current = false;
          return;
        }

        console.log(`[Watchlist Load] Fetching from API for: Broker=${brokerId}, Customer=${customerId}`);

        // OPTIMIZATION: Fetch indexes and watchlist in parallel
        const fetchStart = performance.now();
        const [indexRes, watchlistResponse] = await Promise.all([
          fetch(`${apiBase}/api/instruments/indexes`, { credentials: "include" }).then(res => res.json()),
          fetch(`${apiBase}/api/watchlist/getWatchlist?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => {
            if (!res.ok) throw new Error("Failed to fetch watchlist");
            return res.json();
          })
        ]);
        const fetchElapsed = performance.now() - fetchStart;
        console.log(`[Watchlist Load] API calls completed in ${fetchElapsed.toFixed(0)}ms`);

        // Process indexes - Kite format
        const priorityIndexes = ["NIFTY 50", "NIFTY BANK", "SENSEX", "BANKEX", "NIFTY FIN SERVICE", "NIFTY MID SELECT", "NIFTY MIDCAP 100"];
        const indexInstrumentsRaw = (indexRes || []).sort((a, b) => {
          const aName = (a.tradingsymbol || a.name || "").toUpperCase();
          const bName = (b.tradingsymbol || b.name || "").toUpperCase();
          const aPos = priorityIndexes.findIndex(p => aName.includes(p));
          const bPos = priorityIndexes.findIndex(p => bName.includes(p));
          if (aPos !== -1 && bPos !== -1) return aPos - bPos;
          if (aPos !== -1) return -1;
          if (bPos !== -1) return 1;
          return 0;
        });
        const formattedIndexes = formatInstruments(indexInstrumentsRaw);
        setIndexInstruments(formattedIndexes);

        // Process watchlists (New multiple watchlists response)
        const lists = watchlistResponse?.watchlists || [];
        setWatchlists(lists);

        let initialActiveList = lists.find(wl => (wl.name || 'Main Watchlist') === activeWatchlist);
        if (!initialActiveList && lists.length > 0) {
          initialActiveList = lists[0];
          setActiveWatchlist(initialActiveList.name || 'Main Watchlist');
        } else if (initialActiveList && !activeWatchlist) {
          setActiveWatchlist(initialActiveList.name || 'Main Watchlist');
        }

        let uniqueWatchlist = [];
        if (initialActiveList) {
          const instrumentsArr = initialActiveList.instruments || [];
          const formattedWatchlist = formatInstruments(instrumentsArr);
          uniqueWatchlist = Array.from(new Map(formattedWatchlist.map(item => [item.id ?? item._id ?? item.instrument_token, item])).values());
          setStocks(uniqueWatchlist);
        }

        // Cache the results (Context-specific)
        sessionStorage.setItem(`watchlist_cache${cacheKeySuffix}`, JSON.stringify(uniqueWatchlist));
        sessionStorage.setItem(`indexes_cache${cacheKeySuffix}`, JSON.stringify(formattedIndexes));
        sessionStorage.setItem(`watchlists_meta${cacheKeySuffix}`, JSON.stringify(lists));
        sessionStorage.setItem(`watchlist_cache_time${cacheKeySuffix}`, now.toString());
        console.log(`[Watchlist Load] Cached ${uniqueWatchlist.length} instruments for context: ${cacheKeySuffix}`);

        // Subscribe to market data - default to FULL mode for watchlist
        const subStart = performance.now();
        if (formattedIndexes.length > 0) await subscribeAndSnapshot(formattedIndexes, 'full');
        if (uniqueWatchlist.length > 0) await subscribeAndSnapshot(uniqueWatchlist, 'full');
        const subElapsed = performance.now() - subStart;
        console.log(`[Watchlist Load] Subscriptions completed in ${subElapsed.toFixed(0)}ms`);

        const totalElapsed = performance.now() - startTime;
        console.log(`[Watchlist Load] Total time: ${totalElapsed.toFixed(0)}ms`);

      } catch (e) {
        console.error("[Watchlist Load] Failed:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllInstruments();
  }, [isConnected, apiBase, token, subscribeAndSnapshot, brokerId, customerId]);

  // ... (prices useMemo - SAME AS BEFORE)
  // *** HIGH PERFORMANCE MARKET DATA LOOP ***
  const [prices, setPrices] = useState({});
  const stocksRef = useRef(stocks); // Keep latest stocks in ref to avoid effect dependency re-runs

  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 100; // Update Watchlist max 10 times/sec (smooth enough for human eye)

    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (!ticksRef.current || ticksRef.current.size === 0) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      // Calculate new prices based on current ticksRef and stocks
      const currentStocks = stocksRef.current;
      const ticksMap = ticksRef.current;
      const byId = {};
      const num = (v) => (v == null || v === "" ? null : Number(v));

      let hasUpdates = false;

      currentStocks.forEach((s) => {
        // Kite uses instrument_token as the key
        const tickKey = String(s.instrument_token);
        const snap = snapshots[tickKey] || {};
        const t = ticksMap.get(tickKey) || {}; // Read directly from Mutable Ref

        const combined = { ...snap, ...t };
        const ltp = num(combined.ltp);

        // Calculate changes
        const open = num(combined.open);
        const high = num(combined.dayHigh) ?? num(combined.high);
        const low = num(combined.dayLow) ?? num(combined.low);
        const close = num(combined.close);
        const volume = num(combined.volume);
        const oi = num(combined.oi) ?? num(combined.openInterest);

        let percentChange = num(combined.percentChange);
        if (percentChange == null && ltp != null) {
          if (close != null && close !== 0) percentChange = ((ltp - close) / close) * 100;
          else if (open != null && open !== 0) percentChange = ((ltp - open) / open) * 100;
        }
        let netChange = num(combined.netChange);
        if (netChange == null && ltp != null) {
          if (percentChange != null) netChange = (ltp * (percentChange / 100));
          else if (close != null) netChange = ltp - close;
          else if (open != null) netChange = ltp - open;
        }

        byId[s.id] = {
          ltp, netChange, percentChange,
          isPositive: netChange != null ? netChange >= 0 : (percentChange != null ? percentChange >= 0 : null),
          open, high, low, close, volume, oi,
          bestBidPrice: num(combined.bestBidPrice), bestBidQuantity: num(combined.bestBidQuantity),
          bestAskPrice: num(combined.bestAskPrice), bestAskQuantity: num(combined.bestAskQuantity),
          lastTradeQty: num(combined.lastTradeQty), lastTradeTime: combined.lastTradeTime, depth: combined.depth || null,
        };

        hasUpdates = true;
      });

      if (hasUpdates) {
        setPrices(byId);
        lastUpdate = timestamp;
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [snapshots]); // Only restart loop if snapshots changes (rare)

  useEffect(() => {
    if (!selectedStock) return;
    const p = prices[selectedStock.id] || {};
    setOrderPrice(p?.ltp != null ? Number(p.ltp).toFixed(2) : "");
    setQuantity(1);
  }, [selectedStock, prices]);

  // Upgrade/Upgrade effect removed

  const sheetData = selectedStock ? prices[selectedStock.id] || {} : {};

  // ... (indexPrices useMemo and Index vars - SAME AS BEFORE)
  // *** INDEX PRICES RAF LOOP ***
  const [indexPrices, setIndexPrices] = useState({});
  const indexInstrumentsRef = useRef(indexInstruments);
  useEffect(() => { indexInstrumentsRef.current = indexInstruments; }, [indexInstruments]);

  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 200; // Update Indices slower (5fps is fine)

    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (!ticksRef.current) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const currentIndexes = indexInstrumentsRef.current;
      const ticksMap = ticksRef.current;
      const byId = {};
      const num = (v) => (v == null || v === "" ? null : Number(v));
      let hasUpdates = false;

      currentIndexes.forEach((s) => {
        // Kite uses instrument_token as the key
        const tickKey = String(s.instrument_token);
        let snap = snapshots[tickKey] || {};
        let t = ticksMap.get(tickKey) || {};
        const ltp = num(t.ltp) ?? num(snap.ltp);
        const open = num(t.open) ?? num(snap.open);
        const close = num(t.close) ?? num(snap.close);
        let percentChange = (t.percentChange != null ? num(t.percentChange) : snap.percentChange != null ? num(snap.percentChange) : null);
        if (percentChange == null && ltp != null) {
          if (close != null && close !== 0) percentChange = ((ltp - close) / close) * 100;
          else if (open != null && open !== 0) percentChange = ((ltp - open) / open) * 100;
        }
        let netChange = (t.netChange != null ? num(t.netChange) : snap.netChange != null ? num(snap.netChange) : null);
        if (netChange == null && ltp != null) {
          if (percentChange != null) netChange = (ltp * percentChange) / 100;
          else if (close != null) netChange = ltp - close;
          else if (open != null) netChange = ltp - open;
        }
        byId[s.id] = { ltp, netChange, percentChange, isPositive: netChange != null ? netChange >= 0 : (percentChange != null ? percentChange >= 0 : null), };
        hasUpdates = true;
      });

      if (hasUpdates) {
        setIndexPrices(byId);
        lastUpdate = timestamp;
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [snapshots]);

  // Find index instruments by tradingsymbol (Kite format)
  const sensexInst = indexInstruments.find(i => i.tradingSymbol?.includes('SENSEX') && i.segment === 'INDICES');
  const nifty50Inst = indexInstruments.find(i => i.tradingSymbol?.includes('NIFTY 50') || i.tradingSymbol === 'NIFTY 50');
  const sensexPrice = sensexInst ? indexPrices[sensexInst.id] : {};
  const nifty50Price = nifty50Inst ? indexPrices[nifty50Inst.id] : {};

  // *** Segment Filter Logic - Kite format ***
  const SEGMENT_FILTER_MAP = useMemo(() => ({
    all: null, // Show all instruments in watchlist

    equity: {
      segments: ['NSE', 'BSE'],
      types: ['EQ']
    },

    futures: {
      segments: ['NFO-FUT', 'BFO-FUT', 'MCX-FUT'],
      types: ['FUT']
    },

    options: {
      segments: ['NFO-OPT', 'BFO-OPT', 'MCX-OPT'],
      types: ['CE', 'PE']
    }
  }), []);

  const filteredStocks = useMemo(() => {
    if (activeFilter === 'all') return stocks;
    const filterConfig = SEGMENT_FILTER_MAP[activeFilter];
    if (!filterConfig) return stocks;

    // If filterConfig has segments and types (index/futures/options)
    if (filterConfig.segments && filterConfig.types) {
      return stocks.filter(stock =>
        filterConfig.segments.includes(stock.segment) &&
        filterConfig.types.includes(stock.instrument_type)
      );
    }

    // Legacy: just segment filter array (if needed)
    if (Array.isArray(filterConfig)) {
      return stocks.filter(stock => filterConfig.includes(stock.segment));
    }

    return stocks;
  }, [stocks, activeFilter, SEGMENT_FILTER_MAP]);

  // Get count for each filter category
  const getFilterCount = useCallback((filterKey) => {
    if (filterKey === 'all') return stocks.length;
    const filterConfig = SEGMENT_FILTER_MAP[filterKey];
    if (!filterConfig) return 0;

    // If filterConfig has segments and types (index/futures/options)
    if (filterConfig.segments && filterConfig.types) {
      return stocks.filter(stock =>
        filterConfig.segments.includes(stock.segment) &&
        filterConfig.types.includes(stock.instrument_type)
      ).length;
    }

    // Legacy: just segment filter array (if needed)
    if (Array.isArray(filterConfig)) {
      return stocks.filter(stock => filterConfig.includes(stock.segment)).length;
    }

    return 0;
  }, [stocks, SEGMENT_FILTER_MAP]);

  // Filter tabs configuration
  const FILTER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'equity', label: 'Equity' },
    { key: 'futures', label: 'Futures' },
    { key: 'options', label: 'Options' }
  ];

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;
  const organizationName = localStorage.getItem('organizationName') || 'DHANLAXMI';
  return (
    <div className="w-full h-full bg-[var(--bg-primary)] md:w-1/2 lg:w-3/12 md:border-r border-[var(--border-light)] flex flex-col relative min-h-0">

      {/* Toast Notification */}
      <Toast message={notification.message} type={notification.type} show={notification.show} />

      {/* New Watchlist Modal */}
      {showWatchlistModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] w-[90%] max-w-sm rounded-xl border border-[var(--border-color)] shadow-2xl p-5 animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Create Watchlist</h3>
              <button
                onClick={() => setShowWatchlistModal(false)}
                className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Watchlist Name
                </label>
                <input
                  type="text"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg py-3 px-4 text-[var(--text-primary)] font-semibold outline-none focus:border-indigo-500 transition"
                  placeholder="e.g. Swing Trading"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowWatchlistModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-hover)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const name = newWatchlistName.trim();
                    if (!name) return;
                    if (watchlists.find(w => (w.name || '').toLowerCase() === name.toLowerCase())) {
                      showToast("Watchlist name already exists", "error");
                      return;
                    }
                    const newList = { _id: name, name: name, instruments: [] };
                    setWatchlists([...watchlists, newList]);
                    setActiveWatchlist(name);
                    setStocks([]);
                    setShowWatchlistModal(false);
                    setNewWatchlistName("");
                    if (typeof showToast === 'function') {
                      showToast(`Created ${name}`, "success");
                    }
                  }}
                  disabled={!newWatchlistName.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="pt-4 pb-3 px-4 bg-[var(--bg-primary)] flex-shrink-0 shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-wide">Watchlist</h1>
            {/* <span className="text-lg text-[var(--text-secondary)] font-medium tracking-wide">Options</span> */}
          </div>

          <div className="flex items-center">
            {/* Search Icon */}
            <Link to="/search" className="flex justify-center items-center w-8 h-8 rounded-full border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition ml-1" title="Search">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </Link>

            {/* Jobbing Config Button (Broker Only) */}
            {userRole === 'broker' && <button
              onClick={async () => {
                // Fetch latest jobbing from DB for this customer
                try {
                  const ctx = getActiveContext();
                  const res = await fetch(`${apiBase}/api/funds/getCustomerJobbing?broker_id_str=${ctx.brokerId}&customer_id_str=${ctx.customerId}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.jobbing) {
                      setJobbingType(data.jobbing.type || 'percentage');
                      setJobbingValue(String(data.jobbing.price ?? '0.08'));
                    }
                  }
                } catch (err) { console.error('[Watchlist] Jobbing fetch error:', err); }
                setShowJobbingModal(true);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--bg-hover)] transition ml-1"
              title="Configure Jobbing"
            >
              <Percent className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>}

            {/* Option Limit Config Icon (Broker Only) */}
            {userRole === 'broker' && <button
              onClick={() => setShowLimitModal(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--bg-hover)] transition ml-1"
              title="Configure Option Limit"
            >
              <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>}
          </div>
        </div>
      </div>

      {/* Option Limit Config Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] w-[90%] max-w-sm rounded-xl border border-[var(--border-color)] shadow-2xl p-5 animate-scale-up">
            <div className="flex justify-between items-center mb-4">

              <h3 className="text-lg font-bold text-[var(--text-primary)]">Option Limit Settings</h3>
              <button
                onClick={() => setShowLimitModal(false)}
                className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div >

            <div className="space-y-4">
              <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                <p className="text-xs text-indigo-400">
                  This sets the maximum percentage of available funds that can be used for option trading in a single day.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Daily Option Limit (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg py-3 px-4 text-[var(--text-primary)] font-semibold outline-none focus:border-indigo-500 transition"
                    placeholder="10"
                  />
                  <span className="absolute right-4 top-3.5 text-[var(--text-muted)] font-medium">%</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-hover)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLimit}
                  disabled={savingLimit}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50"
                >
                  {savingLimit ? 'Saving...' : 'Save Limit'}
                </button>
              </div>
            </div>
          </div >
        </div >
      )}

      {/* Jobbing Config Modal */}
      {showJobbingModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] w-[90%] max-w-sm rounded-xl border border-[var(--border-color)] shadow-2xl p-5 animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Jobbing Settings</h3>
              <button
                onClick={() => setShowJobbingModal(false)}
                className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-400">
                  Set manual jobbing value. If set, this overrides the automatic 0.08% default for all orders.
                </p>
              </div>

              {/* Jobbing Type Dropdown */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Jobbing Type
                </label>
                <select
                  value={jobbingType}
                  onChange={(e) => setJobbingType(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg py-3 px-4 text-[var(--text-primary)] font-semibold outline-none focus:border-indigo-500 transition appearance-none cursor-pointer"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="points">Points (₹ Rupees)</option>
                </select>
              </div>

              {/* Jobbing Value Input */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  {jobbingType === 'percentage' ? 'Jobbing Percentage (%)' : 'Jobbing Points (₹)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={jobbingType === 'percentage' ? '0.01' : '1'}
                    min="0"
                    value={jobbingValue}
                    onChange={(e) => setJobbingValue(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg py-3 px-4 text-[var(--text-primary)] font-semibold outline-none focus:border-indigo-500 transition"
                    placeholder={jobbingType === 'percentage' ? '0.08' : '50'}
                  />
                  <span className="absolute right-4 top-3.5 text-[var(--text-muted)] font-medium">
                    {jobbingType === 'percentage' ? '%' : '₹'}
                  </span>
                </div>
              </div>

              {/* Example Preview */}
              <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Preview (Stock ₹200)</p>
                {jobbingType === 'percentage' ? (
                  <>
                    <p className="text-xs text-green-400">BUY: ₹{(200 * (1 + (parseFloat(jobbingValue) || 0) / 100)).toFixed(2)}</p>
                    <p className="text-xs text-red-400">SELL: ₹{(200 * (1 - (parseFloat(jobbingValue) || 0) / 100)).toFixed(2)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-green-400">BUY: ₹{(200 + (parseFloat(jobbingValue) || 0)).toFixed(2)}</p>
                    <p className="text-xs text-red-400">SELL: ₹{(200 - (parseFloat(jobbingValue) || 0)).toFixed(2)}</p>
                  </>
                )}
              </div>



              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClearJobbing}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-hover)] transition"
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveJobbing}
                  className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition"
                >
                  Save Jobbing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Disclosure Modal (Shows once every 24h for customers) */}
      <RiskDisclosureModal />

      {/* Index Scroll Strip */}
      {isLoading && indexInstruments.length === 0 ? (
        <div className="px-2 pb-2 pt-2 bg-[var(--bg-primary)] flex-shrink-0 flex overflow-hidden pointer-events-none gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3.5 py-2.5 rounded-lg mx-1 flex flex-col justify-between animate-pulse shadow-sm"
              style={{ width: '164px', height: '62px' }}>
              <div className="flex justify-between items-center mb-0.5">
                <div className="h-4 bg-[var(--text-muted)]/20 rounded w-12"></div>
                <div className="h-4 bg-[var(--text-muted)]/20 rounded w-16"></div>
              </div>
              <div className="flex justify-between items-center mt-1">
                <div className="h-3 bg-[var(--text-muted)]/15 rounded w-8"></div>
                <div className="h-3 bg-[var(--text-muted)]/15 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : indexInstruments.length > 0 && (
        <div className="px-2 pb-2 pt-2 bg-[var(--bg-primary)] flex-shrink-0 overflow-x-auto "
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <style>{`.index-scroll-strip::-webkit-scrollbar { display: none; }`}</style>
          <div className="index-scroll-strip flex " style={{ minWidth: 'max-content' }}>
            {indexInstruments.map((idx) => {
              const idxPrice = indexPrices[idx.id] || {};
              const rawName = idx.tradingSymbol || idx.name || '';
              let shortName = rawName;
              if (rawName === 'NIFTY 50') shortName = 'NIFTY';
              else if (rawName === 'NIFTY BANK') shortName = 'BANKNIFTY';
              else if (rawName === 'NIFTY MIDCAP 100' || rawName === 'NIFTY MID SELECT') shortName = 'MIDCPNIFTY';
              else if (rawName.startsWith('NIFTY ')) shortName = rawName.replace('NIFTY ', '');
              return (
                <IndexCard
                  key={idx.id}
                  name={shortName}
                  price={idxPrice?.ltp == null ? "--" : idxPrice?.ltp?.toFixed(2)}
                  change={idxPrice?.percentChange == null ? "--" : idxPrice?.percentChange?.toFixed(2)}
                  isPositive={idxPrice?.isPositive}
                  onClick={() => {
                    setBottomWindowMode('Chart');
                    setSelectedStock(idx);
                    setExpandedStockId(idx.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Watchlist Tabs and Filters */}
      <div className="px-4 bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex-shrink-0 flex items-center justify-between">

        {/* Scrollable Watchlists */}
        <div className="flex-1 flex overflow-x-auto items-center pr-2 customscrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.customscrollbar::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex space-x-6 items-center min-w-max">
            {watchlists.map(wl => {
              const wlName = wl.name || 'Main Watchlist';
              const isActive = activeWatchlist === wlName;
              return (
                <button
                  key={wl._id || wlName}
                  onClick={() => switchWatchlist(wlName)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleDeleteWatchlist(wlName);
                  }}
                  onTouchStart={(e) => {
                    if (!window.pressTimerObj) window.pressTimerObj = {};
                    window.pressTimerObj[wlName] = setTimeout(() => {
                      handleDeleteWatchlist(wlName);
                    }, 600); // 600ms hold
                  }}
                  onTouchEnd={() => {
                    if (window.pressTimerObj && window.pressTimerObj[wlName]) {
                      clearTimeout(window.pressTimerObj[wlName]);
                    }
                  }}
                  onTouchMove={() => {
                    if (window.pressTimerObj && window.pressTimerObj[wlName]) {
                      clearTimeout(window.pressTimerObj[wlName]);
                    }
                  }}
                  className={`relative py-3.5 text-[13px] transition-all duration-150 flex items-center gap-1.5 ${isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
                    }`}
                >
                  {isActive && <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>}
                  {wlName}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Action Icons: Filter Dropdown & Add Watchlist (Moved outside overflow so absolute dropdown works) */}
        <div className="flex-shrink-0 flex items-center gap-3 pl-2 py-2">
          {/* Plus icon for creating watchlist */}
          <button
            onClick={() => {
              setNewWatchlistName(`Watchlist ${watchlists.length + 1}`);
              setShowWatchlistModal(true);
            }}
            className="p-1 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            title="Create Watchlist"
          >
            <span className="text-[1.3rem] leading-none font-medium block flex items-center justify-center">+</span>
          </button>
          <div className="h-5 w-[1px] bg-[var(--border-color)] mx-1"></div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`p-1 rounded-full hover:text-blue-600 transition-colors ${showFilterDropdown ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-[var(--text-secondary)]'}`}
              title="Filter Instruments"
            >
              <Filter className="w-4 h-4" />
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-fade-in">
                {FILTER_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveFilter(key);
                      setShowFilterDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${activeFilter === key
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>



        </div>
      </div>

      {/* Live Indicator */}
      <div className="bg-teal-500/10 border-b border-[var(--border-color)] px-4 py-2 flex items-center flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 opacity-80 animate-pulse"></span>
        <span className="text-teal-600 dark:text-teal-400 text-[11px] font-semibold tracking-wide">LIVE - Market data streaming</span>
      </div>

      {/* Swipeable List */}
      <ul className="space-y-0 p-0 flex-1 overflow-y-auto pb-28 min-h-0 mt-0 bg-[var(--bg-primary)]">
        <AnimatePresence>
          {filteredStocks.map((stock) => {
            const p = prices[stock.id] || {};
            return (
              <motion.div
                key={stock.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginLeft: -100 }}
                transition={{ duration: 0.2 }}
              >
                <SwipeableWatchlistItem
                  item={stock}
                  priceData={p}
                  isExpanded={expandedStockId === stock.id}
                  onClick={() => setExpandedStockId(prev => prev === stock.id ? null : stock.id)}
                  onRemove={handleRemoveFromWatchlist}
                  onBuy={() => { setBottomWindowMode('Order'); setSelectedStock(stock); setActionTab("Buy"); }}
                  onSell={() => { setBottomWindowMode('Order'); setSelectedStock(stock); setActionTab("Sell"); }}
                  onChart={() => {
                    setBottomWindowMode('Chart');
                    setSelectedStock(stock);
                  }}
                  onOptionChain={() => {
                    setBottomWindowMode('OptionChain');
                    setSelectedStock(stock);
                    setActionTab("Buy");
                  }}
                  onMarketDepth={() => {
                    setBottomWindowMode('MarketDepth');
                    setSelectedStock(stock);
                    setActionTab("Buy");
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty State & Skeleton Loader */}
        {filteredStocks.length === 0 && (
          isLoading ? (
            <div className="w-full flex flex-col pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-[14px] px-4 border-b border-[var(--border-color)]/50 animate-pulse">
                  <div className="flex flex-col gap-2.5 w-1/2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 bg-[var(--text-muted)]/20 rounded w-28"></div>
                      <div className="h-[14px] bg-[var(--text-muted)]/20 rounded w-8"></div>
                    </div>
                    <div className="h-3 bg-[var(--text-muted)]/15 rounded w-20"></div>
                  </div>
                  <div className="flex flex-col gap-2.5 items-end w-1/3">
                    <div className="h-4 bg-[var(--text-muted)]/20 rounded w-16"></div>
                    <div className="h-3 bg-[var(--text-muted)]/15 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-16 px-4 text-center">
              {stocks.length === 0 ? (
                <>
                  <Search className="w-12 h-12 text-[var(--text-muted)] mb-3" />
                  <h3 className="text-[var(--text-primary)] font-semibold text-lg mb-2">Your Watchlist is Empty</h3>
                  <p className="text-[var(--text-secondary)] text-sm mb-4">Search above to add stocks</p>
                </>
              ) : (
                <>
                  <Search className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                  <h3 className="text-[var(--text-primary)] font-semibold text-base mb-1">No {FILTER_TABS.find(t => t.key === activeFilter)?.label} Instruments</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Add some from the search or switch filter</p>
                </>
              )}
            </div>
          )
        )}
      </ul>

      <BottomWindow
        selectedStock={selectedStock}
        sheetData={sheetData}
        actionTab={actionTab}
        setActionTab={setActionTab}
        quantity={quantity}
        setQuantity={setQuantity}
        orderPrice={orderPrice}
        setOrderPrice={setOrderPrice}
        setSelectedStock={setSelectedStock}
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
        subscriptionType="full"
        ticksRef={ticksRef}
        brokerId={brokerId || getActiveContext().brokerId}
        customerId={customerId || getActiveContext().customerId}
        initialViewMode={bottomWindowMode}
      />
    </div >
  );
}

export default Watchlist;