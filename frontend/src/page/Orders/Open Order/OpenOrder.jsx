import React, { useEffect, useState, useMemo, useRef } from "react";
import { useMarketData } from "../../../contexts/MarketDataContext.jsx";
import { AlertTriangle } from "lucide-react";
import OpenOrderBottomWindow from "./OpenOderBottomWindow.jsx";
import { calculatePnLAndBrokerage, formatTradingSymbolNew } from "../../../Utils/calculateBrokerage.jsx";
import LockedButtonWrapper from "../../../components/LockedButtonWrapper";
import { logMarketStatus } from "../../../Utils/marketStatus.js";

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// Brokerage ONLY on executed entry side (Buy ya Sell) = 0.01%
const BROKERAGE_PERCENT_ON_ENTRY = 0.01; // 0.01%

export default function OpenOrder({ filter }) {
  const [allData, setAllData] = useState([]);
  const [orders, setOrders] = useState({});
  const [instrumentData, setInstrumentData] = useState([]);
  const [loader, setLoader] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrderData, setSelectedOrderData] = useState(null);

  // Exit All
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const { ticksRef, subscribe, unsubscribe } = useMarketData();

  const activeContextString = localStorage.getItem("activeContext");
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const brokerId = activeContext.brokerId;
  const customerId = activeContext.customerId;
  const orderStatus = "OPEN";

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  const apiBase =
    import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:8080";
  const token = localStorage.getItem("token") || null;

  // Segment map no longer needed - using instrument_token directly

  const handleOrderSelect = (orderData) => {
    setSelectedOrderData(orderData);
  };

  const handleCloseWindow = () => {
    setSelectedOrderData(null);
  };

  const [isProcessingId, setIsProcessingId] = useState(null);

  const handleSingleExit = async (data) => {
    if (isProcessingId) return;
    setIsProcessingId(data._id);
    try {
      const ltp = Number(data.snapshot?.ltp || data.ltp || data.price || 0);
      const isBuy = String(data.side || "").toUpperCase() === "BUY";
      const jpValue = Number(data.jobbing_point || 0);
      let closedLtp;
      if (Number(data.customer_exit_price || 0) > 0) {
        closedLtp = Number(data.customer_exit_price);
      } else {
        const refLtp = Number(data.jobbing_applied_ltp || 0) || ltp;
        closedLtp = refLtp;
        if (jpValue > 0 && closedLtp > 0) {
          closedLtp = isBuy ? closedLtp - jpValue : closedLtp + jpValue;
        }
      }

      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        closed_ltp: Number(closedLtp.toFixed(4)),
        order_status: "CLOSED",
        came_From: "Open"
      };

      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchInstrumentData();
      }
    } catch (err) {
      console.error("Exit failed", err);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleRestrictOrder = async (data) => {
    if (isProcessingId) return;
    setIsProcessingId(data._id);
    try {
      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        order_status: "RESTRICTED",
        came_From: "Open",
        closed_at: new Date().toISOString()
      };

      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchInstrumentData();
      }
    } catch (err) {
      console.error("Restriction failed", err);
    } finally {
      setIsProcessingId(null);
    }
  };

  // ---------- 1) FETCH ORDERS ----------
  const fetchInstrumentData = async () => {
    setLoader(true);
    try {
      const endPoint = `${apiBase.replace(
        /\/$/,
        ""
      )}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=${orderStatus}&product=MIS`;

      const res = await fetch(endPoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        setInstrumentData([]);
        setError("Failed to load instruments");
        return;
      }

      const data = await res.json();
      const instruments = Array.isArray(data?.ordersInstrument)
        ? data.ordersInstrument
        : Array.isArray(data)
          ? data
          : [];
      setInstrumentData(instruments);
      setError(null);
    } catch (err) {
      console.error("getOrderInstrument exception:", err);
      setInstrumentData([]);
      setError(String(err));
    } finally {
      setLoader(false);
    }
  };

  // ---------- 2) EXIT ALL HANDLER ----------
  const handleExitAll = async () => {
    setIsExiting(true);
    try {
      const ltpData = {};
      displayList.forEach((order) => {
        const currentLtp = Number(order.snapshot?.ltp ?? order.ltp ?? 0);
        if (order._id) {
          ltpData[order._id] = currentLtp;
        }
      });

      const currentTime = new Date();

      const payload = {
        closed_ltp_map: ltpData,
        closed_at: currentTime,
      };

      const endPoint = `${apiBase.replace(
        /\/$/,
        ""
      )}/api/orders/exitAllOpenOrder?broker_id_str=${brokerId}&customer_id_str=${customerId}`;

      const res = await fetch(endPoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log("Response:", data);
        fetchInstrumentData();
        setShowExitModal(false);
      } else {
        console.error("Failed to exit:", data.message);
        alert(data.message || "Failed to exit orders.");
      }
    } catch (err) {
      console.error("Exit All API Error:", err);
      alert("Network error while exiting orders.");
    } finally {
      setIsExiting(false);
    }
  };

  // initial fetch
  useEffect(() => {
    fetchInstrumentData();
  }, [brokerId, customerId, apiBase, token]);

  // refresh on custom event
  // refresh on custom event
  useEffect(() => {
    const handler = (event) => {
      try {
        fetchInstrumentData();

        // Instant update for selected order if it matches
        const updatedOrder = event.detail?.order;
        if (updatedOrder && selectedOrderData && (selectedOrderData._id === updatedOrder._id || selectedOrderData.order_id === updatedOrder.order_id)) {
          setSelectedOrderData(prev => ({ ...prev, ...updatedOrder }));
        }
      } catch { }
    };
    window.addEventListener("orders:changed", handler);
    return () => window.removeEventListener("orders:changed", handler);
  }, [brokerId, customerId, apiBase, token, selectedOrderData]);

  // ---------- 3) WEBSOCKET SUBSCRIPTION ----------
  useEffect(() => {
    if (!Array.isArray(instrumentData) || instrumentData.length === 0) {
      setOrders({});
      return;
    }

    (async () => {
      try {
        // Use instrument_token for Kite WebSocket subscription
        const items = instrumentData
          .map((item) => {
            const token = item.instrument_token;
            if (!token) return null;
            return { instrument_token: String(token) };
          })
          .filter(Boolean);

        if (items.length === 0) {
          setOrders({});
          return;
        }

        try {
          await subscribe(items, "quote");
        } catch (e) {
          console.warn(e);
        }

        const url = `${apiBase.replace(/\/$/, "")}/api/quotes/snapshot`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ items }),
        });

        if (!res.ok) {
          setOrders({});
          return;
        }

        const snapshotData = await res.json();
        let snapshotMap = {};
        if (
          snapshotData &&
          typeof snapshotData === "object" &&
          !Array.isArray(snapshotData)
        ) {
          snapshotMap = snapshotData;
        } else if (Array.isArray(snapshotData)) {
          snapshotData.forEach((it) => {
            const id = String(it.securityId ?? it.security_Id ?? it.id ?? "");
            if (id) snapshotMap[id] = it;
            if (it.segment && id) snapshotMap[`${it.segment}|${id}`] = it;
          });
        }
        setOrders(snapshotMap);
      } catch (err) {
        setOrders({});
      }
    })();

    return () => {
      // Unsubscribe using instrument_token
      const items = instrumentData
        .map((item) => ({
          instrument_token: String(item.instrument_token)
        }))
        .filter((i) => i.instrument_token);
      if (items.length > 0)
        unsubscribe(items, "quote").catch((e) => { });
    };
  }, [instrumentData, subscribe, unsubscribe, apiBase, token]);

  // ---------- 4.1) RAF Loop for Live Ticks ----------
  const [liveTicks, setLiveTicks] = useState({});
  const instrumentDataRef = useRef(instrumentData);
  useEffect(() => { instrumentDataRef.current = instrumentData; }, [instrumentData]);

  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 200;

    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (!ticksRef.current || !instrumentDataRef.current || instrumentDataRef.current.length === 0) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const ticksMap = ticksRef.current;
      const currentData = instrumentDataRef.current;
      const newTicks = {};
      let hasUpdates = false;

      currentData.forEach(inst => {
        // Use instrument_token directly as key (Kite format)
        const tickKey = String(inst.instrument_token);
        const tick = ticksMap.get(tickKey);
        if (tick) {
          newTicks[tickKey] = tick;
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        setLiveTicks(prev => newTicks);
        lastUpdate = timestamp;
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };
    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // ---------- 4.2) MERGE SNAPSHOT + LIVE TICKS ----------
  useEffect(() => {
    if (!instrumentData || instrumentData.length === 0) {
      setAllData([]);
      return;
    }
    const merged = instrumentData.map((inst) => {
      // Use instrument_token as the key for tick lookup
      const tickKey = String(inst.instrument_token);
      let snapshot = null;
      if (orders && typeof orders === "object") {
        snapshot = orders[tickKey] ?? null;
      }
      const tick = liveTicks[tickKey] || {};
      const combined = { ...snapshot, ...tick };
      return { ...inst, snapshot: combined };
    });
    setAllData(merged);
  }, [instrumentData, orders, liveTicks]);

  // ---------- 5) selectedOrderMarketData ----------
  const selectedOrderMarketData = useMemo(() => {
    if (!selectedOrderData) return {};
    const foundItem = allData.find(
      (item) =>
        item._id === selectedOrderData._id ||
        (item.instrument_token &&
          item.instrument_token === selectedOrderData.instrument_token)
    );
    return foundItem?.snapshot ?? {};
  }, [selectedOrderData, allData]);

  const displayList = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    if (!filter || filter === 'All') return allData;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return allData.filter(item => {
      const itemDate = new Date(item.created_at || item.createdAt || now);

      if (filter === 'Today') {
        return itemDate >= startOfToday;
      }
      if (filter === 'Last 7 Days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= sevenDaysAgo;
      }
      if (filter === 'Last 30 Days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return itemDate >= thirtyDaysAgo;
      }
      return true;
    });
  }, [allData, filter]);

  // ---------- 6) SKELETON LOADER ----------
  const OrderCardSkeleton = () => (
    <div className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl animate-pulse mb-4">
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2 mb-2"></div>
          <div className="h-2 bg-[var(--bg-secondary)] rounded w-1/4"></div>
        </div>
        <div className="text-right">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-16 mb-2 ml-auto"></div>
          <div className="h-6 bg-[var(--bg-secondary)] rounded-full w-20 ml-auto"></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)]/40 p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-2 bg-[var(--bg-secondary)] rounded w-8"></div>
            <div className="h-3 bg-[var(--bg-secondary)] rounded w-12"></div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-12 bg-[var(--bg-secondary)] rounded-2xl"></div>
        <div className="flex-1 h-12 bg-[var(--bg-secondary)] rounded-2xl"></div>
      </div>
    </div>
  );

  if (loader) {
    return (
      <div className="flex flex-col px-1">
        <div className="flex justify-between items-center mb-6">
          <div className="h-4 bg-[var(--bg-secondary)] rounded w-32 animate-pulse"></div>
        </div>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 text-xs mb-2">{error}</p>
          <button
            onClick={fetchInstrumentData}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* HEADER + EXIT ALL */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="text-[#808a9d] text-[10px] font-black uppercase tracking-[2px]">
          Open Orders ({displayList.length})
        </h3>

        {displayList.length > 0 && userRole === 'broker' && (
          <button
            onClick={() => setShowExitModal(true)}
            className="border border-[#f23645]/40 text-[#f23645] bg-[#f23645]/5 hover:bg-[#f23645] hover:text-white
                        px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-200 
                        uppercase "
          >
            All Exit
          </button>
        )}
      </div>

      {/* LIST */}
      <ul className="space-y-4">
        {displayList.map((data, idx) => {
          const tradingsymbolRaw =
            data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
          const tradingsymbol = String(tradingsymbolRaw ?? "");

          const isOptionChainOrder = data?.meta?.from === 'ui_option_chain';
          const snapshotLtp = Number(data.snapshot?.ltp ?? 0);

          let displayLtp = (isOptionChainOrder && (snapshotLtp === 0 || !data.snapshot?.ltp))
            ? Number(data.price ?? 0)
            : (snapshotLtp || Number(data.ltp ?? data.price ?? 0));

          const sideUpper = String(data.side ?? "").toUpperCase();
          const isBuy = sideUpper === "BUY";

          const ltp = displayLtp;
          const avg = Number(data.price ?? 0);
          const qty = Number(data?.quantity ?? 0);

          // (Jobbing Point applied ONLY upon execution of Exit, not on Display)
          let pnlLtp = ltp;

          const {
            totalBrokerage,
            netPnl,
            pct,
          } = calculatePnLAndBrokerage({
            side: sideUpper,
            avgPrice: avg,
            ltp: pnlLtp,
            qty,
            brokeragePercentPerSide: BROKERAGE_PERCENT_ON_ENTRY,
            mode: "entry-only",
            symbol: tradingsymbol,
          });

          const profit = netPnl >= 0;
          const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
          const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
          const arrow = profit ? "▲" : "▼";
          const pctText = `${arrow} ${netPnl.toFixed(2)} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

          return (
            <li
              key={
                data._id ||
                data.id ||
                `${data.segment}-${data.security_Id}-${idx}`
              }
              className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all"
            >
              {/* Header: Title, Segment, Status & Price */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
                      {formatTradingSymbolNew(tradingsymbol) || "—"}
                    </h4>
                    <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
                      {data.segment || "NFO"}
                    </span>
                    <span className="text-[7px] font-black text-[var(--gain-text)] bg-[var(--gain-chip-bg)] px-1.5 py-0.5 rounded uppercase">
                      OPEN
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase">
                    <span>MIS • {data.segment}</span>
                    <span className={`px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
                      {sideUpper}
                    </span>
                    <span>• {qty} QTY</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5">
                    ₹{ltp.toFixed(2)}
                  </div>
                  <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${pnlChipBg} ${pnlTextColor}`}>
                    {pctText}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5 text-center">
                <div className="flex flex-col gap-1">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Avg Price</p>
                  <p className="text-xs font-black text-[var(--text-primary)]">₹{avg.toFixed(2)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
                  <p className="text-xs font-black text-[var(--text-primary)]">{qty}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
                  <p className={`text-xs font-black ${pnlTextColor}`}>₹{netPnl.toFixed(2)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col justify-between gap-2 w-full">
                {userRole === 'broker' ? (
                  <>
                    {/* Row 1: Modify & Restrict */}
                    <div className="flex gap-5 w-full">
                      <LockedButtonWrapper featureId="modify_order" className="flex-1">
                        <button
                          onClick={() => handleOrderSelect(data)}
                          className="w-full py-3.5 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
                        >
                          Modify
                        </button>
                      </LockedButtonWrapper>

                      <button
                        onClick={() => handleRestrictOrder(data)}
                        disabled={isProcessingId === data._id}
                        className={`flex-1 py-3.5 px-7 bg-amber-500 text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all ${isProcessingId === data._id ? 'opacity-50' : ''}`}
                      >
                        Restrict
                      </button>
                    </div>

                    {/* Row 2: Exit */}
                    <LockedButtonWrapper featureId="cancel_order" className="w-full">
                      <button
                        onClick={() => handleSingleExit(data)}
                        disabled={isProcessingId === data._id}
                        className={`w-full py-3.5 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all ${isProcessingId === data._id ? 'opacity-50' : ''}`}
                      >
                        {isProcessingId === data._id ? 'Exiting...' : 'Exit'}
                      </button>
                    </LockedButtonWrapper>
                  </>
                ) : (
                  /* Customer: Modify & Exit in one row */
                  <div className="flex gap-2 w-full">
                    <LockedButtonWrapper featureId="modify_order" className="flex-1">
                      <button
                        onClick={() => handleOrderSelect(data)}
                        className="w-full py-3.5 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
                      >
                        Modify
                      </button>
                    </LockedButtonWrapper>

                    {(userRole === 'broker' || logMarketStatus(data.segment)) && (
                      <LockedButtonWrapper featureId="cancel_order" className="flex-1">
                        <button
                          onClick={() => handleSingleExit(data)}
                          disabled={isProcessingId === data._id}
                          className={`w-full py-3.5 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all ${isProcessingId === data._id ? 'opacity-50' : ''}`}
                        >
                          {isProcessingId === data._id ? 'Exiting...' : 'Exit'}
                        </button>
                      </LockedButtonWrapper>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* BOTTOM SHEET */}
      {selectedOrderData && (
        <OpenOrderBottomWindow
          selectedOrder={selectedOrderData}
          onClose={handleCloseWindow}
          sheetData={selectedOrderMarketData}
        />
      )}

      {/* EXIT ALL MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isExiting && setShowExitModal(false)}
          />
          <div className="relative bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-500 w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Exit All Orders?
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Are you sure you want to exit all {displayList.length} open
                orders? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowExitModal(false)}
                  disabled={isExiting}
                  className="flex-1 px-4 py-2.5 bg-[#0f172a] hover:bg-[#1a253a] border border-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExitAll}
                  disabled={isExiting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isExiting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Exiting...
                    </>
                  ) : (
                    "Yes, Exit All"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}