// HoldOrder.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import HoldOrderBottomWindow from "./holdOrderBottomWindow.jsx";
import { calculatePnLAndBrokerage, formatTradingSymbol } from "../../../Utils/calculateBrokerage.jsx";
import { useMarketData } from "../../../contexts/MarketDataContext.jsx";

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// Brokerage config – 0.01% per side
const ENTRY_BROKERAGE_PERCENT = 0.01; // 0.01% (ENTRY ONLY for holdings)

export default function HoldOrder({ filter }) {
  const list = [];

  const [orders, setOrders] = useState({});
  const [instrumentData, setInstrumentData] = useState([]);
  const [loader, setLoader] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  const [isProcessingId, setIsProcessingId] = useState(null);

  const { ticksRef, subscribe, unsubscribe } = useMarketData();
  const subscribeRef = useRef(subscribe);
  const unsubscribeRef = useRef(unsubscribe);

  useEffect(() => {
    subscribeRef.current = subscribe;
    unsubscribeRef.current = unsubscribe;
  }, [subscribe, unsubscribe]);

  const activeContextString = localStorage.getItem("activeContext");
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const brokerId = activeContext.brokerId;
  const customerId = activeContext.customerId;
  const orderStatus = "HOLD";

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
  const token = localStorage.getItem("token") || null;

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  // Segment map no longer needed - using instrument_token directly

  const handleOrderSelect = (orderData) => {
    setSelectedOrderData(orderData);
  };

  const handleCloseWindow = () => {
    setSelectedOrderData(null);
  };

  const handleSingleExit = async (data) => {
    if (isProcessingId) return;
    setIsProcessingId(data._id || data.id);
    try {
      const liveLtp = Number(data.snapshot?.ltp ?? 0);
      const initialPrice = Number(data.price ?? 0);
      const currentPrice = liveLtp || initialPrice;
      const orderSide = String(data.side ?? "").toUpperCase();
      const isBuy = orderSide === "BUY";

      const jpValue = Number(data.jobbing_point || 0);
      let closedLtp;
      if (Number(data.customer_exit_price || 0) > 0) {
        closedLtp = Number(data.customer_exit_price);
      } else {
        const refLtp = Number(data.jobbing_applied_ltp || 0) || currentPrice;
        closedLtp = refLtp;
        if (jpValue > 0 && closedLtp > 0) {
          closedLtp = isBuy ? closedLtp - jpValue : closedLtp + jpValue;
        }
      }

      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        instrument_token: data.instrument_token,
        symbol: data.meta?.selectedStock?.tradingSymbol ?? data.symbol ?? "",
        side: orderSide,
        product: data.product,
        segment: data.segment,
        lots: String(data.lots || 1),
        quantity: Number(data.quantity || data.qty || 0),
        closed_ltp: Number(Number(closedLtp).toFixed(4)),
        closed_at: new Date().toISOString(),
        order_status: "CLOSED",
        came_From: "Hold",
        meta: { from: 'ui_holding_order_closure_direct' }
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
    setIsProcessingId(data._id || data.id);
    try {
      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        order_status: "RESTRICTED",
        came_From: "Hold",
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

  // ---- FETCH HOLD ORDERS ----
  const fetchInstrumentData = useCallback(async () => {
    if (!brokerId || !customerId) {
      setLoader(false);
      return;
    }

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
  }, [brokerId, customerId, apiBase, token, orderStatus]);

  useEffect(() => {
    fetchInstrumentData();
  }, [fetchInstrumentData]);

  useEffect(() => {
    const handler = () => {
      try {
        fetchInstrumentData();
      } catch { }
    };
    window.addEventListener("orders:changed", handler);
    return () => window.removeEventListener("orders:changed", handler);
  }, [fetchInstrumentData]);

  // ---- SNAPSHOT + WEBSOCKET ----
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
          await (subscribeRef.current
            ? subscribeRef.current(items, "quote")
            : subscribe(items, "quote"));
        } catch (e) {
          console.warn("[HoldOrder] subscribe failed:", e);
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
        console.error("[HoldOrder] snapshot fetch exception:", err);
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

      if (items.length > 0) {
        const fn = unsubscribeRef.current || unsubscribe;
        fn(items, "quote").catch((e) =>
          console.warn("[HoldOrder] Unsubscribe failed:", e)
        );
      }
    };
  }, [instrumentData, subscribe, unsubscribe, apiBase, token]);

  // --- HIGH PERF: RAF LOOP for Live Ticks ---
  const [liveTicks, setLiveTicks] = useState({});
  const instrumentDataRef = useRef(instrumentData);

  useEffect(() => {
    instrumentDataRef.current = instrumentData;
  }, [instrumentData]);

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

  // ---- MERGE instruments + snapshots + liveTicks ----
  const displayList = useMemo(() => {
    if (!instrumentData || instrumentData.length === 0) {
      return list;
    }

    let merged = instrumentData.map((inst) => {
      // Use instrument_token as the key
      const tickKey = String(inst.instrument_token);
      let snapshot = null;

      if (orders && typeof orders === "object") {
        snapshot = orders[tickKey] ?? null;
      }

      const tick = liveTicks[tickKey] || {};
      const combined = { ...snapshot, ...tick };
      return { ...inst, snapshot: combined };
    });

    // Sort by latest activity desc
    merged.sort((a, b) => {
      const getTime = (o) => {
        const dates = [o.created_at, o.createdAt, o.updatedAt]
          .filter(Boolean)
          .map(d => new Date(d).getTime())
          .filter(t => !isNaN(t));
        return dates.length > 0 ? Math.max(...dates) : 0;
      };
      return getTime(b) - getTime(a);
    });

    // Date Filtering
    if (!filter || filter === 'All') return merged;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return merged.filter(item => {
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
  }, [instrumentData, orders, liveTicks, list, filter]);

  const selectedOrderMarketData = useMemo(() => {
    if (!selectedOrderData) return {};
    const foundItem = displayList.find(
      (item) =>
        item._id === selectedOrderData._id ||
        (item.instrument_token &&
          item.instrument_token === selectedOrderData.instrument_token)
    );
    return foundItem?.snapshot ?? {};
  }, [selectedOrderData, displayList]);

  // ---- SKELETON LOADER ----
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
        <div className="flex justify-between items-center mb-4">
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
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[2px]">
          Holdings ({displayList.length})
        </h3>
      </div>

      <ul className="pb-24 overflow-auto px-1">
        {displayList.map((data, idx) => {
          const tradingsymbolRaw =
            data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
          const tradingsymbol = String(tradingsymbolRaw ?? "");

          const sideUpper = String(data.side ?? "").toUpperCase();
          const isBuy = sideUpper === "BUY";

          let displayLtp = Number(data.snapshot?.ltp ?? data.ltp ?? 0);
          const ltp = displayLtp;
          const avg = Number(data.average_price ?? data.price ?? 0);
          const qty = Number(data.quantity || data.qty || 0);

          const {
            netPnl,
            pct,
            brokerageEntry,
          } = calculatePnLAndBrokerage({
            side: sideUpper,
            avgPrice: avg,
            ltp,
            qty,
            brokeragePercentPerSide: ENTRY_BROKERAGE_PERCENT,
            mode: "entry-only",
            symbol: tradingsymbol,
          });

          const profit = netPnl >= 0;
          const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
          const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
          const pctText = `${profit ? "▲ +" : "▼ "}${netPnl.toFixed(
            2
          )} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

          return (
            <li
              key={
                data._id ||
                data.id ||
                `${data.segment}-${data.instrument_token}-${idx}`
              }
              className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all mb-4"
            >
              {/* Header: Title, Segment, Status & Price */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
                      {formatTradingSymbol(tradingsymbol) || "—"}
                    </h4>
                    <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
                      {data.segment || "NFO"}
                    </span>
                    <span className="text-[7px] font-black text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded uppercase">
                      HOLDING
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

              {/* Action Buttons - Only visible for brokers */}
              {userRole === 'broker' && (
                <div className="flex flex-col gap-2 w-full">
                  {/* Row 1: Modify & Restrict */}
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleOrderSelect(data)}
                      className="w-full py-3.5 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      Modify
                    </button>
                    <button
                      onClick={() => handleRestrictOrder(data)}
                      disabled={isProcessingId === (data._id || data.id)}
                      className={`w-full py-3.5 bg-amber-500 text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all ${isProcessingId === (data._id || data.id) ? 'opacity-50' : ''}`}
                    >
                      Restrict
                    </button>
                  </div>

                  {/* Row 2: Exit */}
                  <button
                    onClick={() => handleSingleExit(data)}
                    disabled={isProcessingId === (data._id || data.id)}
                    className={`w-full py-3.5 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all ${isProcessingId === (data._id || data.id) ? 'opacity-50' : ''}`}
                  >
                    {isProcessingId === (data._id || data.id) ? 'Exiting...' : 'Exit'}
                  </button>
                </div>
              )}

              {/* Brokerage tag - Only visible for brokers */}
              {userRole === 'broker' && (
                <div className="mt-3 text-[8px] text-[#808a9d] text-center opacity-40 font-black uppercase tracking-tighter">
                  Est. Brokerage (entry): -{money(brokerageEntry)}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {selectedOrderData && (
        <HoldOrderBottomWindow
          selectedOrder={selectedOrderData}
          onClose={handleCloseWindow}
          sheetData={selectedOrderMarketData}
        />
      )}
    </>
  );
}
