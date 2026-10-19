import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Zap, Filter, PieChart, X, FileText, ChevronLeft, TrendingUp, Layers, Activity
} from "lucide-react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logMarketStatus } from "../../Utils/marketStatus.js";
import { calculateExitBrokerageAndPnL, calculatePnLAndBrokerage, formatTradingSymbol } from "../../Utils/calculateBrokerage.jsx";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";
import HoldOrderBottomWindow from "../Orders/Holding/holdOrderBottomWindow.jsx";
import OpenOrderBottomWindow from "../Orders/Open Order/OpenOderBottomWindow.jsx";

// --- Helpers ---
const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
// Chip background for gain/loss indication
const chipBg = (n) => Number(n) > 0 ? "bg-[var(--gain-chip-bg)]" : Number(n) < 0 ? "bg-[var(--loss-chip-bg)]" : "bg-transparent";
// Text color for % and P&L (green/red)
const pnlTextColor = (n) => Number(n) > 0 ? "text-[var(--gain-text)]" : Number(n) < 0 ? "text-[var(--loss-text)]" : "text-[var(--text-primary)]";
const signSym = (n) => (Number(n) > 0 ? "+" : "");
const arrow = (n) => (Number(n) > 0 ? "▲" : Number(n) < 0 ? "▼" : "");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// --- Portfolio Card (AngelOne Style) ---
const PortfolioCard = ({ title, count, pnl, description, icon: Icon, actionText, onClick }) => {
  const isPositive = pnl >= 0;
  const pnlColor = pnl !== undefined ? (isPositive ? "text-[#089981]" : "text-[#f23645]") : "";

  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm transition-all duration-200 hover:brightness-105 active:scale-[0.99] flex items-center justify-between mb-4 cursor-pointer"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Icon Wrapper with Indigo tint */}
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
          <Icon className="w-6 h-6" />
        </div>

        {/* Texts */}
        <div className="min-w-0 flex-1">
          <h4 className="text-[var(--text-primary)] font-black text-sm uppercase tracking-wider mb-1 leading-none">
            {title}
          </h4>
          {description ? (
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide truncate">
              {description}
            </p>
          ) : (
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide truncate">
              {count} Closed Positions
            </p>
          )}
          {pnl !== undefined && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Realized P&L:</span>
              <span className={`text-[11px] font-black tracking-wide ${pnlColor}`}>
                {isPositive ? "+" : ""}{pnl.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button className="ml-4 px-4 py-2 border border-[#3b82f6]/40 text-[#3b82f6] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#3b82f6]/10 active:scale-[0.95] transition-all">
        {actionText}
      </button>
    </div>
  );
};

const getOrderValues = (order) => {
  const qty = parseFloat(order.quantity) || 0;
  let entryPrice = parseFloat(order.average_price);
  if (!entryPrice) entryPrice = parseFloat(order.price) || 0;
  let exitPrice = parseFloat(order.closed_ltp);
  if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;
  return { qty, entryPrice, exitPrice };
};

// ==========================================
// 1. CLOSED ORDER FILTER COMPONENT
// ==========================================
const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "day", label: "Day(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
  { value: "expiry", label: "Expired Symbol" },
];

function ClosedOrderFilter({ closedOrders = [], onFilter }) {
  const [range, setRange] = useState("all");
  const [nValue, setNValue] = useState(1);
  const [selectedExpiredSymbol, setSelectedExpiredSymbol] = useState("");

  // compute expired symbols
  const expiredSymbols = useMemo(() => {
    const now = new Date();
    const setSym = new Set();
    for (const o of closedOrders) {
      const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
      const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
      if (!expRaw || !tradingSymbol) continue;
      const exp = new Date(expRaw);
      if (exp <= endOfDay(now)) {
        setSym.add(tradingSymbol);
      }
    }
    return Array.from(setSym).sort();
  }, [closedOrders]);

  const computeFiltered = () => {
    const now = new Date();
    const end = endOfDay(now);

    if (range === "all") return closedOrders.slice();

    if (range === "expiry") {
      const list = closedOrders.filter((o) => {
        const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
        if (!expRaw) return false;
        return new Date(expRaw) <= end;
      });
      if (!selectedExpiredSymbol) return list;
      return list.filter((o) => {
        const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
        return String(tradingSymbol) === String(selectedExpiredSymbol);
      });
    }

    let start = null;
    if (range === "today") start = startOfDay(now);
    else if (range === "day") {
      const s = new Date(now); s.setDate(s.getDate() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "month") {
      const s = new Date(now); s.setMonth(s.getMonth() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "year") {
      const s = new Date(now); s.setFullYear(s.getFullYear() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    }

    if (!start) return closedOrders.slice();

    return closedOrders.filter((o) => {
      const closedAtRaw = o?.closed_at || o?.closedAt || o?.updatedAt || o?.createdAt;
      if (!closedAtRaw) return false;
      const closed = new Date(closedAtRaw);
      return closed >= start && closed <= end;
    });
  };

  const applyFilter = () => {
    if (onFilter) onFilter(computeFiltered());
  };

  const resetFilter = () => {
    setRange("today");
    setNValue(1);
    setSelectedExpiredSymbol("");
    if (onFilter) onFilter(closedOrders.slice());
  };

  const showNumberInput = ["day", "month", "year"].includes(range);

  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filter Orders</h3>
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">Time Range</label>
        <select
          value={range}
          onChange={(e) => { setRange(e.target.value); setSelectedExpiredSymbol(""); setNValue(1); }}
          className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500"
        >
          {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {showNumberInput && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Units back</label>
          <input
            type="number" min="1" value={nValue}
            onChange={(e) => setNValue(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          />
        </div>
      )}

      {range === "expiry" && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Select Symbol</label>
          <select
            value={selectedExpiredSymbol}
            onChange={(e) => setSelectedExpiredSymbol(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          >
            <option value="">— All expired —</option>
            {expiredSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={applyFilter} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm transition-colors">Apply Filter</button>
        <button onClick={resetFilter} className="flex-1 py-2 bg-transparent border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">Reset</button>
      </div>
    </div>
  );
}

// ==========================================
// 1.5. PORTFOLIO SKELETON LOADER
// ==========================================
const PortfolioSkeleton = () => (
  <div className="flex flex-col space-y-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl animate-pulse">
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
          {[1, 2, 3].map(j => (
            <div key={j} className="flex flex-col items-center gap-2">
              <div className="h-2 bg-[var(--bg-secondary)] rounded w-8"></div>
              <div className="h-3 bg-[var(--bg-secondary)] rounded w-12"></div>
            </div>
          ))}
        </div>
        <div className="h-12 bg-[var(--bg-secondary)] rounded-2xl w-full"></div>
      </div>
    ))}
  </div>
);

// ==========================================
// 2. PORTFOLIO ITEM CARD
// ==========================================
const PortfolioItem = ({ data, onClick }) => {
  const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
  const { qty, entryPrice, exitPrice } = getOrderValues(data);
  const sideUpper = String(data.side ?? "").toUpperCase();
  const isBuy = sideUpper === "BUY";
  const isRestricted = data.order_status === "RESTRICTED";

  const { netPnl, pct } = isRestricted
    ? { netPnl: 0, pct: 0 }
    : calculateExitBrokerageAndPnL({
      side: sideUpper,
      avgPrice: entryPrice,
      exitPrice,
      qty,
      symbol: tradingsymbol
    });

  const profit = netPnl >= 0;
  const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
  const pnlTextColorClass = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
  const pnlArrow = profit ? "▲" : "▼";

  return (
    <div
      onClick={() => onClick(data)}
      className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all mb-4 cursor-pointer hover:brightness-105"
    >
      {/* Header: Title, Segment, Status & Price */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
              {formatTradingSymbol(tradingsymbol)}
            </h4>
            <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
              {data.segment || "NFO"}
            </span>
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${isRestricted ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-[var(--loss-text)] bg-[var(--loss-chip-bg)]'}`}>
              {isRestricted ? 'REJECTED' : 'CLOSED'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase">
            <span>{data.product === 'MIS' ? 'Intraday' : 'Overnight'} • {data.segment || 'NFO'}</span>
            <span className={`px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
              {sideUpper}
            </span>
            <span>• {qty} QTY</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5">
            {isRestricted ? "—" : `₹${exitPrice.toFixed(2)}`}
          </div>
          <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${isRestricted ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : pnlChipBg} ${isRestricted ? '' : pnlTextColorClass}`}>
            {isRestricted ? "REJECTED" : `${pnlArrow} ${netPnl.toFixed(2)} (${profit ? "+" : ""}${pct.toFixed(2)}%)`}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Entry Price</p>
          <p className="text-xs font-black text-[var(--text-primary)]">₹{entryPrice.toFixed(2)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
          <p className="text-xs font-black text-[var(--text-primary)]">{qty}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
          <p className={`text-xs font-black ${isRestricted ? 'text-amber-500' : pnlTextColorClass}`}>
            {isRestricted ? "—" : `₹${netPnl.toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Action Button */}
      {/* <div className="w-full py-3.5 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        <BarChart className="w-3.5 h-3.5" />
        View Details
      </div> */}
    </div>
  );
};

// ==========================================
// 2.5. HOLDING PORTFOLIO ITEM CARD (Live Open Holdings)
// ==========================================
const HoldingPortfolioItem = ({ data, userRole, onExit, onRestrict, onModify }) => {
  const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
  const sideUpper = String(data.side ?? "").toUpperCase();
  const isBuy = sideUpper === "BUY";
  const profit = data.netPnl >= 0;
  const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
  const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
  const pnlArrow = profit ? "▲" : "▼";

  return (
    <div className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all mb-4">
      {/* Header: Title, Segment, Status & Price */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
              {formatTradingSymbol(tradingsymbol)}
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
            <span>• {data.qty} QTY</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5">
            ₹{Number(data?.ltp ?? 0).toFixed(2)}
          </div>
          <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${pnlChipBg} ${pnlTextColor}`}>
            {pnlArrow} {Number(data?.netPnl ?? 0).toFixed(2)} ({profit ? "+" : ""}{Number(data?.pct ?? 0).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Avg Price</p>
          <p className="text-xs font-black text-[var(--text-primary)]">₹{Number(data?.avg ?? 0).toFixed(2)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
          <p className="text-xs font-black text-[var(--text-primary)]">{data?.qty ?? 0}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
          <p className={`text-xs font-black ${pnlTextColor}`}>₹{Number(data?.netPnl ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Action Buttons - Only visible for brokers */}
      {userRole === 'broker' && (
        <div className="flex flex-col gap-2 w-full">
          {/* Row 1: Modify & Restrict */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => onModify(data)}
              className="flex-1 py-3 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Modify
            </button>
            <button
              onClick={() => onRestrict(data)}
              className="flex-1 py-3 bg-amber-500 text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Restrict
            </button>
          </div>

          {/* Row 2: Exit */}
          <button
            onClick={() => onExit(data)}
            className="w-full py-3 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Exit Position
          </button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2.7. OPEN PORTFOLIO ITEM CARD (Live Open Positions/Orders)
// ==========================================
const OpenPortfolioItem = ({ data, userRole, onExit, onRestrict, onModify }) => {
  const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
  const sideUpper = String(data.side ?? "").toUpperCase();
  const isBuy = sideUpper === "BUY";
  const profit = data.netPnl >= 0;
  const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
  const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";
  const pnlArrow = profit ? "▲" : "▼";

  return (
    <div className="bg-[var(--bg-card)] rounded-3xl p-5 border border-[var(--border-color)] shadow-2xl transition-all mb-4 animate-in fade-in slide-in-from-bottom duration-300">
      {/* Header: Title, Segment, Status & Price */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-[var(--text-primary)] font-black text-base uppercase tracking-tight truncate">
              {formatTradingSymbol(tradingsymbol)}
            </h4>
            <span className="text-[7px] font-black text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded uppercase">
              {data.segment || "NFO"}
            </span>
            <span className="text-[7px] font-black text-[var(--gain-text)] bg-[var(--gain-chip-bg)] px-1.5 py-0.5 rounded uppercase animate-pulse">
              OPEN
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase">
            <span>MIS • {data.segment}</span>
            <span className={`px-1 rounded ${isBuy ? 'bg-[var(--gain-chip-bg)] text-[var(--gain-text)]' : 'bg-[var(--loss-chip-bg)] text-[var(--loss-text)]'}`}>
              {sideUpper}
            </span>
            <span>• {data.qty} QTY</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-primary)] font-black text-lg leading-none mb-1.5">
            ₹{Number(data?.ltp ?? 0).toFixed(2)}
          </div>
          <div className={`text-[9px] font-black px-2.5 py-1 rounded-full ${pnlChipBg} ${pnlTextColor}`}>
            {pnlArrow} {Number(data?.netPnl ?? 0).toFixed(2)} ({profit ? "+" : ""}{Number(data?.pct ?? 0).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]/30 mb-5 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Avg Price</p>
          <p className="text-xs font-black text-[var(--text-primary)]">₹{Number(data?.avg ?? 0).toFixed(2)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Quantity</p>
          <p className="text-xs font-black text-[var(--text-primary)]">{data?.qty ?? 0}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase opacity-60">Net P&L</p>
          <p className={`text-xs font-black ${pnlTextColor}`}>₹{Number(data?.netPnl ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col justify-between gap-2 w-full">
        {userRole === 'broker' ? (
          <>
            {/* Row 1: Modify & Restrict */}
            <div className="flex gap-2 w-full">
              <button
                onClick={() => onModify(data)}
                className="flex-1 py-3 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Modify
              </button>

              <button
                onClick={() => onRestrict(data)}
                className="flex-1 py-3 bg-amber-500 text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Restrict
              </button>
            </div>

            {/* Row 2: Exit */}
            <button
              onClick={() => onExit(data)}
              className="w-full py-3 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Exit Position
            </button>
          </>
        ) : (
          /* Customer: Modify & Exit */
          <div className="flex gap-2 w-full">
            <button
              onClick={() => onModify(data)}
              className="flex-1 py-3 bg-[#3b82f6] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Modify
            </button>
            {(userRole === 'broker' || logMarketStatus(data.segment)) && (
              <button
                onClick={() => onExit(data)}
                className="flex-1 py-3 bg-[#f23645] text-white text-[11px] font-black uppercase tracking-[2px] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Exit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. MAIN PORTFOLIO COMPONENT
// ==========================================
export default function Portfolio() {
  const [allOrders, setAllOrders] = useState([]); // Raw data from API
  const [filteredOrders, setFilteredOrders] = useState([]); // Data shown in list
  const [summary, setSummary] = useState({ invested: 0, current: 0, totalPnl: 0 });
  const [loader, setLoader] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "landing"; // "landing", "equity_fno", "mcx", "holding", "open"

  // Live Market Data Context Hooks & State
  const { ticksRef, subscribe, unsubscribe } = useMarketData();
  const [holdingOrders, setHoldingOrders] = useState([]);
  const [holdingSnapshots, setHoldingSnapshots] = useState({});
  const [holdingLiveTicks, setHoldingLiveTicks] = useState({});

  const [openOrders, setOpenOrders] = useState([]);
  const [openSnapshots, setOpenSnapshots] = useState({});
  const [openLiveTicks, setOpenLiveTicks] = useState({});

  // UI State for Switcher
  const [showFilter, setShowFilter] = useState(false);

  // API Params
  const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");

  // Filter allOrders by tab first
  const tabFilteredOrders = useMemo(() => {
    if (currentTab === "mcx") {
      return allOrders.filter(o => {
        if (o.order_status !== "CLOSED") return false;
        const seg = String(o?.segment || "").toUpperCase();
        return seg.includes("MCX");
      });
    } else if (currentTab === "equity_fno") {
      return allOrders.filter(o => {
        if (o.order_status !== "CLOSED") return false;
        const seg = String(o?.segment || "").toUpperCase();
        return !seg.includes("MCX");
      });
    } else if (currentTab === "rejected") {
      return allOrders.filter(o => o.order_status === "RESTRICTED");
    }
    return allOrders;
  }, [allOrders, currentTab]);

  // -------------------------------------------------------------
  // OPEN HOLDINGS & OPEN ORDERS (LIVE DATA) LOGIC & CALCULATION
  // -------------------------------------------------------------
  const fetchHoldingOrders = async () => {
    if (!brokerId || !customerId) return;
    try {
      const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
      const url = `${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=HOLD&product=MIS`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const data = await res.json();
      const instruments = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
      setHoldingOrders(instruments);

      // Fetch snapshots and subscribe
      if (instruments.length > 0) {
        const items = instruments.map(inst => ({ instrument_token: String(inst.instrument_token) }));
        subscribe(items, "quote");

        const snapRes = await fetch(`${baseUrl}/api/quotes/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ items }),
        });
        if (snapRes.ok) {
          const snapshotMap = await snapRes.json();
          setHoldingSnapshots(snapshotMap);
        }
      }
    } catch (e) {
      console.warn("[Portfolio holdings fetch error]:", e);
    }
  };

  const fetchOpenOrders = async () => {
    if (!brokerId || !customerId) return;
    try {
      const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
      const url = `${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=OPEN&product=MIS`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const data = await res.json();
      const instruments = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
      setOpenOrders(instruments);

      // Fetch snapshots and subscribe
      if (instruments.length > 0) {
        const items = instruments.map(inst => ({ instrument_token: String(inst.instrument_token) }));
        subscribe(items, "quote");

        const snapRes = await fetch(`${baseUrl}/api/quotes/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ items }),
        });
        if (snapRes.ok) {
          const snapshotMap = await snapRes.json();
          setOpenSnapshots(snapshotMap);
        }
      }
    } catch (e) {
      console.warn("[Portfolio open orders fetch error]:", e);
    }
  };

  // Unsubscribe on unmount
  useEffect(() => {
    return () => {
      if (holdingOrders.length > 0) {
        const items = holdingOrders.map(o => ({ instrument_token: String(o.instrument_token) }));
        unsubscribe(items, "quote").catch(console.warn);
      }
    };
  }, [holdingOrders, unsubscribe]);

  useEffect(() => {
    return () => {
      if (openOrders.length > 0) {
        const items = openOrders.map(o => ({ instrument_token: String(o.instrument_token) }));
        unsubscribe(items, "quote").catch(console.warn);
      }
    };
  }, [openOrders, unsubscribe]);

  // Combined Live Ticker RAF loop
  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 200;

    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (!ticksRef.current) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const ticksMap = ticksRef.current;

      // Update Holdings
      if (holdingOrders.length > 0) {
        const newTicks = {};
        let hasUpdates = false;
        holdingOrders.forEach(inst => {
          const tickKey = String(inst.instrument_token);
          const tick = ticksMap.get(tickKey);
          if (tick) {
            newTicks[tickKey] = tick;
            hasUpdates = true;
          }
        });
        if (hasUpdates) {
          setHoldingLiveTicks(newTicks);
        }
      }

      // Update Open Orders
      if (openOrders.length > 0) {
        const newTicks = {};
        let hasUpdates = false;
        openOrders.forEach(inst => {
          const tickKey = String(inst.instrument_token);
          const tick = ticksMap.get(tickKey);
          if (tick) {
            newTicks[tickKey] = tick;
            hasUpdates = true;
          }
        });
        if (hasUpdates) {
          setOpenLiveTicks(newTicks);
        }
      }

      lastUpdate = timestamp;
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [holdingOrders, openOrders, ticksRef]);

  // Merge holdings
  const displayHoldings = useMemo(() => {
    const ENTRY_BROKERAGE_PERCENT = 0.01;
    return holdingOrders.map(inst => {
      const tickKey = String(inst.instrument_token);
      const snapshot = holdingSnapshots[tickKey] ?? null;
      const tick = holdingLiveTicks[tickKey] ?? {};
      const combined = { ...snapshot, ...tick };

      const ltp = Number(combined.ltp ?? inst.ltp ?? 0);
      const avg = Number(inst.average_price ?? inst.price ?? 0);
      const qty = Number(inst.quantity || inst.qty || 0);
      const side = String(inst.side ?? "").toUpperCase();

      const { netPnl, pct } = calculatePnLAndBrokerage({
        side,
        avgPrice: avg,
        ltp,
        qty,
        brokeragePercentPerSide: ENTRY_BROKERAGE_PERCENT,
        mode: "entry-only",
        symbol: inst.symbol || inst.meta?.selectedStock?.tradingSymbol || "",
      });

      const entryValue = avg * qty;
      const currentValue = ltp * qty;

      return {
        ...inst,
        snapshot: combined,
        ltp,
        avg,
        qty,
        netPnl,
        pct,
        entryValue,
        currentValue
      };
    });
  }, [holdingOrders, holdingSnapshots, holdingLiveTicks]);

  // Merge open orders
  const displayOpenOrders = useMemo(() => {
    const BROKERAGE_PERCENT_ON_ENTRY = 0.01;
    return openOrders.map(inst => {
      const tickKey = String(inst.instrument_token);
      const snapshot = openSnapshots[tickKey] ?? null;
      const tick = openLiveTicks[tickKey] ?? {};
      const combined = { ...snapshot, ...tick };

      const ltp = Number(combined.ltp ?? inst.ltp ?? inst.price ?? 0);
      const avg = Number(inst.price ?? 0);
      const qty = Number(inst.quantity || inst.qty || 0);
      const side = String(inst.side ?? "").toUpperCase();

      // (Jobbing Point applied ONLY upon execution of Exit, not on Display)
      let pnlLtp = ltp;

      const { netPnl, pct } = calculatePnLAndBrokerage({
        side,
        avgPrice: avg,
        ltp: pnlLtp,
        qty,
        brokeragePercentPerSide: BROKERAGE_PERCENT_ON_ENTRY,
        mode: "entry-only",
        symbol: inst.symbol || inst.meta?.selectedStock?.tradingSymbol || "",
      });

      const entryValue = avg * qty;
      const currentValue = ltp * qty;

      return {
        ...inst,
        snapshot: combined,
        ltp,
        avg,
        qty,
        netPnl,
        pct,
        entryValue,
        currentValue
      };
    });
  }, [openOrders, openSnapshots, openLiveTicks]);

  // Holding stats
  const holdingStats = useMemo(() => {
    let invested = 0, current = 0, pnl = 0;
    displayHoldings.forEach(h => {
      invested += h.entryValue;
      current += h.currentValue;
      pnl += h.netPnl;
    });
    return { invested, current, pnl, count: displayHoldings.length };
  }, [displayHoldings]);

  // Open stats
  const openStats = useMemo(() => {
    let invested = 0, current = 0, pnl = 0;
    displayOpenOrders.forEach(h => {
      invested += h.entryValue;
      current += h.currentValue;
      pnl += h.netPnl;
    });
    return { invested, current, pnl, count: displayOpenOrders.length };
  }, [displayOpenOrders]);

  // Action Handlers
  const handleModifyHolding = (orderData) => {
    setSelectedOrder(orderData);
  };

  const handleHoldingExit = async (data) => {
    try {
      const liveLtp = Number(data.ltp ?? 0);
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
        meta: { from: 'ui_portfolio_holding_exit' }
      };

      const res = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL || ""}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchHoldingOrders();
        fetchClosedOrders();
      }
    } catch (err) {
      console.error("Holding exit failed", err);
    }
  };

  const handleHoldingRestrict = async (data) => {
    try {
      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        order_status: "RESTRICTED",
        came_From: "Hold",
        closed_at: new Date().toISOString()
      };

      const res = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL || ""}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchHoldingOrders();
        fetchClosedOrders();
      }
    } catch (err) {
      console.error("Holding restriction failed", err);
    }
  };

  const handleModifyOpenOrder = (orderData) => {
    setSelectedOrder(orderData);
  };

  const handleOpenOrderExit = async (data) => {
    try {
      const ltp = Number(data.ltp ?? data.price ?? 0);
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

      const res = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL || ""}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchOpenOrders();
        fetchClosedOrders();
      }
    } catch (err) {
      console.error("Open order exit failed", err);
    }
  };

  const handleOpenOrderRestrict = async (data) => {
    try {
      const payload = {
        broker_id_str: brokerId,
        customer_id_str: customerId,
        order_id: data._id,
        order_status: "RESTRICTED",
        came_From: "Open",
        closed_at: new Date().toISOString()
      };

      const res = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL || ""}/api/orders/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('orders:changed'));
        fetchOpenOrders();
        fetchClosedOrders();
      }
    } catch (err) {
      console.error("Open order restriction failed", err);
    }
  };

  // Sync tabFilteredOrders to filteredOrders
  useEffect(() => {
    if (currentTab === "holding") {
      setFilteredOrders(displayHoldings);
      setSummary({
        invested: holdingStats.invested,
        current: holdingStats.current,
        totalPnl: holdingStats.pnl
      });
    } else if (currentTab === "open") {
      setFilteredOrders(displayOpenOrders);
      setSummary({
        invested: openStats.invested,
        current: openStats.current,
        totalPnl: openStats.pnl
      });
    } else {
      setFilteredOrders(tabFilteredOrders);
      calculateSummary(tabFilteredOrders);
    }
  }, [tabFilteredOrders, currentTab, displayHoldings, holdingStats, displayOpenOrders, openStats]);

  // Calculate statistics (P&L, invested, count) for sub-portfolios dynamically
  const stats = useMemo(() => {
    let eqInvested = 0, eqCurrent = 0, eqPnl = 0, eqCount = 0;
    let mcxInvested = 0, mcxCurrent = 0, mcxPnl = 0, mcxCount = 0;
    let rejCount = 0;

    allOrders.forEach(order => {
      if (order.order_status === 'RESTRICTED') {
        rejCount++;
        return; // Skip rejected/restricted trades for P&L calculations
      }

      const { qty, entryPrice, exitPrice } = getOrderValues(order);
      const side = String(order.side ?? "").toUpperCase();
      const { entryValue, exitValue, netPnl } = calculateExitBrokerageAndPnL({
        side,
        avgPrice: entryPrice,
        exitPrice,
        qty,
        symbol: order.symbol || order.meta?.selectedStock?.tradingSymbol || ""
      });

      const isMcx = String(order?.segment || "").toUpperCase().includes("MCX");
      if (isMcx) {
        mcxInvested += entryValue;
        mcxCurrent += exitValue;
        mcxPnl += netPnl;
        mcxCount++;
      } else {
        eqInvested += entryValue;
        eqCurrent += exitValue;
        eqPnl += netPnl;
        eqCount++;
      }
    });

    return {
      equity: { invested: eqInvested, current: eqCurrent, pnl: eqPnl, count: eqCount },
      mcx: { invested: mcxInvested, current: mcxCurrent, pnl: mcxPnl, count: mcxCount },
      rejected: { count: rejCount }
    };
  }, [allOrders]);

  // Fetch Data
  const fetchClosedOrders = async () => {
    console.log(`[Portfolio] Fetching for Broker: ${brokerId}, Customer: ${customerId}`);
    if (!brokerId || !customerId) {
      console.warn('[Portfolio] Missing context, skipping load');
      setLoader(false);
      return;
    }
    setLoader(true);
    try {
      const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
      // Request orderStatus=ALL to get both CLOSED and RESTRICTED (rejected) orders
      const url = `${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=ALL`;
      console.log('[Portfolio] API URL:', url);

      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        console.error('[Portfolio] API Error:', res.status);
        throw new Error("Failed");
      }
      const data = await res.json();
      console.log('[Portfolio] API Response:', data);

      // Filter for only CLOSED and RESTRICTED orders
      const rawOrders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
      const orders = rawOrders.filter(o => o.order_status === "CLOSED" || o.order_status === "RESTRICTED");

      const sortedOrders = [...orders].sort((a, b) => {
        const getTime = (o) => {
          const dates = [o.closed_at, o.closedAt, o.updatedAt, o.createdAt]
            .filter(Boolean)
            .map(d => new Date(d).getTime())
            .filter(t => !isNaN(t));
          return dates.length > 0 ? Math.max(...dates) : 0;
        };
        return getTime(b) - getTime(a);
      });

      setAllOrders(sortedOrders);
    } catch (err) {
      console.error('[Portfolio] Load Failed:', err);
    } finally {
      setLoader(false);
    }
  };

  // Recalculate summary based on visible orders
  const calculateSummary = (orders) => {
    const acc = orders.reduce((a, order) => {
      if (order.order_status === 'RESTRICTED') return a; // Skip rejected/restricted trades

      const { qty, entryPrice, exitPrice } = getOrderValues(order);
      const side = String(order.side ?? "").toUpperCase();

      const { entryValue, exitValue, netPnl } = calculateExitBrokerageAndPnL({
        side,
        avgPrice: entryPrice,
        exitPrice,
        qty,
        symbol: order.symbol || order.meta?.selectedStock?.tradingSymbol || ""
      });

      a.invested += entryValue;
      a.current += exitValue;
      a.totalPnl += netPnl;
      return a;
    }, { invested: 0, current: 0, totalPnl: 0 });

    setSummary(acc);
  };

  const handleFilterResult = (results) => {
    setFilteredOrders(results);
    calculateSummary(results);
    // Optional: Auto close filter on apply? 
    // setShowFilter(false); 
  };

  useEffect(() => {
    fetchClosedOrders();
    fetchHoldingOrders();
    fetchOpenOrders();
    const handler = () => {
      fetchClosedOrders();
      fetchHoldingOrders();
      fetchOpenOrders();
    };
    window.addEventListener('orders:changed', handler);
    return () => window.removeEventListener('orders:changed', handler);
  }, [brokerId, customerId]);

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  const getTitle = () => {
    if (currentTab === 'mcx') return 'MCX Portfolio';
    if (currentTab === 'equity_fno') return 'Equity & F&O Portfolio';
    if (currentTab === 'holding') return 'Open Holdings';
    if (currentTab === 'open') return 'Open Portfolio';
    return 'Portfolio';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <div className="flex items-center">
          {currentTab !== "landing" && (
            <button
              onClick={() => setSearchParams({})}
              className="p-1 hover:bg-[var(--bg-secondary)] rounded-full mr-1.5 text-[var(--text-muted)] hover:text-white transition-all duration-150 active:scale-90"
              title="Back to Overview"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}
          <h2 className="text-[26px] font-black tracking-tighter leading-none uppercase">{getTitle()}</h2>
        </div>
        <div className="flex gap-2">
          {/* Switcher Button (only if not on landing page) */}
          {currentTab !== "landing" && currentTab !== "holding" && currentTab !== "open" && (
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`
                          flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 shadow-sm
                          ${showFilter
                  ? "bg-[#3b82f6] text-white border-[#3b82f6] shadow-lg shadow-[#3b82f6]/20"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
                }
                      `}
            >
              {showFilter ? (
                <>
                  <PieChart className="w-3.5 h-3.5" />
                  Summary
                </>
              ) : (
                <>
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-2">
        {currentTab === "landing" ? (
          /* ============================================================ */
          /* LANDING PAGE: Overall Summary + Navigation Cards (AngelOne Style) */
          /* ============================================================ */
          <div className="space-y-6">
            {/* Overall Summary Card */}
            <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] p-6 rounded-3xl shadow-xl shadow-blue-500/20 border-none animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
              {/* Subtle background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl"></div>

              <div className="flex flex-wrap justify-between items-start gap-4 mb-6 relative z-10">
                <div className="min-w-fit flex-1">
                  <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Total Invested</p>
                  <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">{money(summary.invested)}</p>
                </div>
                <div className="min-w-fit flex-1 text-right">
                  <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Realized Value</p>
                  <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">{money(summary.current)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-5 border-t border-white/20 relative z-10">
                <p className="text-blue-100 text-[11px] font-black uppercase tracking-widest">Total Realized P&L</p>
                <span className={`text-lg sm:text-xl font-black px-4 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 whitespace-nowrap`}>
                  {summary.totalPnl >= 0 ? "+" : ""}{money(summary.totalPnl)}
                </span>
              </div>
            </div>

            {/* Navigation Cards section */}
            <div className="pt-2">
              <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[2px] mb-4 px-1">
                Portfolio Sections
              </h3>

              {/* Open Portfolio Card */}
              <PortfolioCard
                title="Open Portfolio"
                count={openStats.count}
                pnl={openStats.pnl}
                icon={Activity}
                actionText="VIEW"
                onClick={() => setSearchParams({ tab: 'open' })}
              />

              {/* Open Holdings Portfolio Card */}
              <PortfolioCard
                title="Holdings Portfolio"
                count={holdingStats.count}
                pnl={holdingStats.pnl}
                icon={Layers}
                actionText="VIEW"
                onClick={() => setSearchParams({ tab: 'holding' })}
              />

              {/* Equity & F&O Portfolio Card */}
              <PortfolioCard
                title="Equity & F&O Portfolio"
                count={stats.equity.count}
                pnl={stats.equity.pnl}
                icon={TrendingUp}
                actionText="VIEW"
                onClick={() => setSearchParams({ tab: 'equity_fno' })}
              />

              {/* MCX Portfolio Card */}
              <PortfolioCard
                title="MCX Portfolio"
                count={stats.mcx.count}
                pnl={stats.mcx.pnl}
                icon={Zap}
                actionText="VIEW"
                onClick={() => setSearchParams({ tab: 'mcx' })}
              />

              {/* Rejected Portfolio Card */}
              <PortfolioCard
                title="Rejected Portfolio"
                count={stats.rejected.count}
                icon={X}
                actionText="VIEW"
                onClick={() => setSearchParams({ tab: 'rejected' })}
              />

              {/* Tax Invoice Card */}
              {userRole === 'broker' && (
                <PortfolioCard
                  title="Tax Invoice"
                  description="Generate & download tax statements"
                  icon={FileText}
                  actionText="OPEN"
                  onClick={() => navigate('/portfolio/invoice')}
                />
              )}
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* SUB-PORTFOLIO VIEW: Filter / Summary + Closed Positions List */
          /* ============================================================ */
          <>
            {/* SWAPPABLE AREA: Summary vs Filter */}
            {currentTab !== "rejected" && (
              <div className="mb-6 relative">
                {showFilter ? (
                  <ClosedOrderFilter
                    closedOrders={tabFilteredOrders}
                    onFilter={handleFilterResult}
                  />
                ) : (
                  <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] p-6 rounded-3xl shadow-xl shadow-blue-500/20 border-none animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                    {/* Subtle background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl"></div>

                    {/* Portfolio Summary Card */}
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-6 relative z-10">
                      <div className="min-w-fit flex-1">
                        <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">
                          {currentTab === 'holding' || currentTab === 'open' ? 'Current Value' : 'Total Invested'}
                        </p>
                        <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">
                          {currentTab === 'holding' || currentTab === 'open' ? money(summary.current) : money(summary.invested)}
                        </p>
                      </div>
                      <div className="min-w-fit flex-1 text-right">
                        <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">
                          {currentTab === 'holding' || currentTab === 'open' ? 'Total Invested' : 'Realized Value'}
                        </p>
                        <p className="text-2xl sm:text-3xl font-black text-white break-all leading-none">
                          {currentTab === 'holding' || currentTab === 'open' ? money(summary.invested) : money(summary.current)}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-5 border-t border-white/20 relative z-10">
                      <p className="text-blue-100 text-[11px] font-black uppercase tracking-widest">
                        {currentTab === 'holding' || currentTab === 'open' ? 'Total Open P&L' : 'Total Realized P&L'}
                      </p>
                      <span className={`text-lg sm:text-xl font-black px-4 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 whitespace-nowrap`}>
                        {summary.totalPnl >= 0 ? "+" : ""}{money(summary.totalPnl)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List Header */}
            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[2px] mb-4 flex items-center justify-between px-1">
              <span>{currentTab === 'holding' || currentTab === 'open' ? 'Open Positions' : 'Closed Positions'} ({currentTab === 'holding' ? displayHoldings.length : currentTab === 'open' ? displayOpenOrders.length : filteredOrders.length})</span>
              {/* Show indicator if filtered */}
              {currentTab !== 'holding' && currentTab !== 'open' && allOrders.length !== filteredOrders.length && (
                <span className="text-[8px] bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-0.5 rounded-full border border-[#3b82f6]/20">Filtered</span>
              )}
            </h3>

            {/* The List */}
            {loader && <PortfolioSkeleton />}

            {!loader && currentTab === 'holding' && displayHoldings.map((order, idx) => (
              <HoldingPortfolioItem
                key={order._id || idx}
                data={order}
                userRole={userRole}
                onExit={handleHoldingExit}
                onRestrict={handleHoldingRestrict}
                onModify={handleModifyHolding}
              />
            ))}

            {!loader && currentTab === 'open' && displayOpenOrders.map((order, idx) => (
              <OpenPortfolioItem
                key={order._id || idx}
                data={order}
                userRole={userRole}
                onExit={handleOpenOrderExit}
                onRestrict={handleOpenOrderRestrict}
                onModify={handleModifyOpenOrder}
              />
            ))}

            {!loader && currentTab !== 'holding' && currentTab !== 'open' && filteredOrders.map((order, idx) => (
              <PortfolioItem
                key={order._id || idx}
                data={order}
                onClick={setSelectedOrder}
              />
            ))}

            {!loader && (currentTab === 'holding' ? displayHoldings.length : currentTab === 'open' ? displayOpenOrders.length : filteredOrders.length) === 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-10 text-center flex flex-col items-center shadow-xl">
                <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4">
                  <Filter className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                </div>
                <p className="text-[var(--text-primary)] font-black uppercase text-sm mb-1">No orders found</p>
                {currentTab !== 'holding' && currentTab !== 'open' && allOrders.length > 0 && <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">Try adjusting your filters</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Render modify modal drawer for Open Holdings */}
      {selectedOrder && currentTab === 'holding' && (
        <HoldOrderBottomWindow
          selectedOrder={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          sheetData={selectedOrder.snapshot || {}}
        />
      )}

      {/* Render modify modal drawer for Open Orders */}
      {selectedOrder && currentTab === 'open' && (
        <OpenOrderBottomWindow
          selectedOrder={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          sheetData={selectedOrder.snapshot || {}}
        />
      )}
    </div>
  );
}