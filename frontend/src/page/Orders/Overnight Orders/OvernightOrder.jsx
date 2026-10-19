// OvernightOrder.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { MOCK_ORDERS } from "../mockData";
import { useMarketData } from "../../../contexts/MarketDataContext.jsx";
import OvernightOrderBottomWindow from "./OvernightOrderBottomWindow.jsx";
import { calculatePnLAndBrokerage, formatTradingSymbol } from "../../../Utils/calculateBrokerage.jsx";

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// sirf ENTRY side pe 0.01%
const ENTRY_BROKERAGE_PERCENT = 0.01;

export default function OvernightOrder({ filter }) {
  const list = MOCK_ORDERS.filter((o) => o.status === "HOLD");

  const [allData, setAllData] = useState([]);
  const [orders, setOrders] = useState({}); // snapshot map/object
  const [instrumentData, setInstrumentData] = useState([]);
  const [loader, setLoader] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrderData, setSelectedOrderData] = useState(null);

  // Add WebSocket connection
  const { ticksRef, subscribe, unsubscribe, isConnected } = useMarketData();

  const activeContextString = localStorage.getItem("activeContext");
  const activeContext = activeContextString
    ? JSON.parse(activeContextString)
    : {};
  const brokerId = activeContext.brokerId;
  const customerId = activeContext.customerId;
  // Normalize status to match backend enum values
  const orderStatus = "HOLD";

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
  const token = localStorage.getItem("token") || null;

  // Segment map no longer needed - using instrument_token directly

  const handleOrderSelect = (orderData) => {
    setSelectedOrderData(orderData);
  };

  const handleCloseWindow = () => {
    setSelectedOrderData(null);
  };

  // get instrumentData (extracted to a reusable function so we can re-run it)
  const fetchInstrumentData = async () => {
    setLoader(true);
    try {
      // Fetch only overnight (NRML) orders from backend
      const endPoint = `${apiBase.replace(
        /\/$/,
        ""
      )}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=${orderStatus}&product=NRML`;

      const res = await fetch(endPoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        let text = "<no-body>";
        try {
          text = await res.text();
        } catch (e) { }
        console.error(
          "getOrderInstrument failed:",
          res.status,
          res.statusText,
          text
        );
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

  useEffect(() => {
    // initial fetch
    fetchInstrumentData();
  }, [brokerId, customerId, apiBase, token]);

  // Listen for 'orders:changed' events
  useEffect(() => {
    const handler = (e) => {
      try {
        console.debug(
          "[OvernightOrder] orders:changed received, refetching orders"
        );
        fetchInstrumentData();
      } catch (err) {
        console.warn("[OvernightOrder] orders:changed handler error", err);
      }
    };

    window.addEventListener("orders:changed", handler);
    return () => window.removeEventListener("orders:changed", handler);
  }, [brokerId, customerId, apiBase, token]);

  // Subscribe to WebSocket and fetch snapshot when instrumentData ready
  useEffect(() => {
    if (!Array.isArray(instrumentData) || instrumentData.length === 0) {
      console.log("[OvernightOrder] instrument is not array or is empty");
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
          console.log("[OvernightOrder] items array empty");
          setOrders({});
          return;
        }

        // 1) subscribe WS
        try {
          console.log(
            `[OvernightOrder] Subscribing to ${items.length} instruments via WebSocket...`
          );
          await subscribe(items, "quote");
          console.log("[OvernightOrder] WebSocket subscription successful");
        } catch (e) {
          console.warn(
            "[OvernightOrder] WebSocket subscribe failed:",
            e?.message || e
          );
        }

        // 2) snapshot
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
          let text = "<no-body>";
          try {
            text = await res.text();
          } catch (e) { }
          console.error(
            "[OvernightOrder] snapshot fetch failed:",
            res.status,
            res.statusText,
            text
          );
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
        console.error("[OvernightOrder] snapshot fetch exception:", err);
        setOrders({});
      }
    })();

    // cleanup
    return () => {
      // Unsubscribe using instrument_token
      const items = instrumentData
        .map((item) => ({
          instrument_token: String(item.instrument_token)
        }))
        .filter((i) => i.instrument_token);

      if (items.length > 0) {
        console.log(
          `[OvernightOrder] Unsubscribing from ${items.length} instruments...`
        );
        unsubscribe(items, "quote").catch((e) =>
          console.warn("[OvernightOrder] Unsubscribe failed:", e)
        );
      }
    };
  }, [instrumentData, subscribe, unsubscribe, apiBase, token]);

  // --- HIGH PERF: RAF LOOP for Live Ticks ---
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

  useEffect(() => {
    if (!instrumentData || instrumentData.length === 0) {
      setAllData([]);
      return;
    }

    const merged = instrumentData.map((inst) => {
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

    setAllData(merged);
  }, [instrumentData, orders, liveTicks]);

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
    let merged = [];
    if (!allData || allData.length === 0) {
      merged = list;
    } else {
      merged = allData;
    }

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
  }, [allData, list, filter]);
  // ---- SKELETON LOADER ----
  const OrderCardSkeleton = () => (
    <div className="bg-[#1e222d] rounded-2xl p-4 border border-[#2a2e39] mb-4 shadow-xl animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="h-4 bg-[#2a2e39] rounded w-1/2 mb-2"></div>
          <div className="h-1.5 bg-[#2a2e39] rounded w-1/4"></div>
        </div>
        <div className="text-right">
          <div className="h-4 bg-[#2a2e39] rounded w-16 mb-2 ml-auto"></div>
          <div className="h-5 bg-[#2a2e39] rounded-full w-20 ml-auto"></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[#131722]/50 p-2.5 rounded-xl border border-[#2a2e39]">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-1.5 bg-[#2a2e39] rounded w-6"></div>
            <div className="h-3 bg-[#2a2e39] rounded w-10"></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loader) {
    return (
      <div className="flex flex-col px-1">
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 bg-[#2a2e39] rounded w-32 animate-pulse"></div>
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
          Overnight ({displayList.length})
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
          const pctText = `${profit ? "▲ " : "▼ "}${netPnl.toFixed(
            2
          )} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

          return (
            <li
              key={
                data._id ||
                data.id ||
                `${data.segment}-${data.instrument_token}-${idx}`
              }
              className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] mb-4 shadow-xl transition-all hover:border-[var(--text-muted)]/30 cursor-pointer"
              onClick={() => handleOrderSelect(data)}
            >
              {/* Header: Title, Segment, Status & LTP/PnL */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[var(--text-primary)] font-black text-sm uppercase tracking-tight truncate">
                      {formatTradingSymbol(tradingsymbol) || "—"}
                    </h4>
                    <span className="text-[8px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
                      {data.segment || "NFO"}
                    </span>
                    <span className="text-[8px] font-black text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded uppercase">
                      OVERNIGHT
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] font-black text-[var(--text-muted)] uppercase">
                    <span>NRML • {data.segment}</span>
                    <span className={`px-1.5 py-0.5 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
                      {sideUpper}
                    </span>
                    <span>• {qty} Qty</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--text-primary)] font-black text-sm leading-none mb-1">
                    ₹{ltp.toFixed(2)}
                  </div>
                  <div className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block ${pnlChipBg} ${pnlTextColor}`}>
                    {pctText}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-2.5 rounded-xl border border-[var(--border-color)]/30">
                <div>
                  <p className="text-[7px] font-black text-[var(--text-muted)] uppercase mb-1">Avg Price</p>
                  <p className="text-[11px] font-black text-[var(--text-primary)]">{money(avg)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[7px] font-black text-[var(--text-muted)] uppercase mb-1">Quantity</p>
                  <p className="text-[11px] font-black text-[var(--text-primary)]">{qty}</p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-black text-[var(--text-muted)] uppercase mb-1">Net P&L</p>
                  <p className={`text-[11px] font-black ${pnlTextColor}`}>
                    {money(netPnl)}
                  </p>
                </div>
              </div>

              {/* Brokerage tag */}
              <div className="mt-3 text-[8px] text-[#808a9d] text-center opacity-40 font-black uppercase tracking-tighter">
                Est. Brokerage (entry): -{money(brokerageEntry)}
              </div>
            </li>
          );
        })}
      </ul>

      {selectedOrderData && (
        <OvernightOrderBottomWindow
          selectedOrder={selectedOrderData}
          onClose={handleCloseWindow}
          sheetData={selectedOrderMarketData}
        />
      )}
    </>
  );
}