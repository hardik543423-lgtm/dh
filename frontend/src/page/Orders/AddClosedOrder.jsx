import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PlusCircle, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AddClosedOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCustomerId = searchParams.get("customerId");

  // Get activeContext values
  const activeContext = JSON.parse(localStorage.getItem("activeContext") || "{}");
  const brokerId = activeContext.brokerId || "";
  const customerId = urlCustomerId || activeContext.customerId || "";

  // Form states
  const [symbol, setSymbol] = useState("");
  const [segment, setSegment] = useState("NFO");
  const [side, setSide] = useState("BUY");
  const [product, setProduct] = useState("MIS");
  const [price, setPrice] = useState("");
  const [closedLtp, setClosedLtp] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lots, setLots] = useState("1");
  const [lotSize, setLotSize] = useState("1");
  const [expire, setExpire] = useState("");
  const [cameFrom, setCameFrom] = useState("Open");
  const [placedAt, setPlacedAt] = useState(() => {
    const d = new Date();
    // Default to 30 mins ago
    d.setMinutes(d.getMinutes() - 30);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [closedAt, setClosedAt] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symbol.trim()) {
      setFeedback({ type: "error", message: "Symbol is required" });
      return;
    }
    if (!price || Number(price) <= 0) {
      setFeedback({ type: "error", message: "Invalid Entry Price" });
      return;
    }
    if (!closedLtp || Number(closedLtp) <= 0) {
      setFeedback({ type: "error", message: "Invalid Exit Price (Closed LTP)" });
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setFeedback({ type: "error", message: "Invalid Quantity" });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");

    const payload = {
      broker_id_str: brokerId,
      customer_id_str: customerId,
      symbol: symbol.trim().toUpperCase(),
      segment,
      side,
      product,
      price: Number(price),
      closed_ltp: Number(closedLtp),
      quantity: Number(quantity),
      lots: Number(lots),
      lot_size: Number(lotSize),
      instrument_token: "0",
      placed_at: new Date(placedAt).toISOString(),
      closed_at: new Date(closedAt).toISOString(),
      expire: expire ? new Date(expire).toISOString() : null,
      came_From: cameFrom,
    };

    try {
      const res = await fetch(`${apiBase}/api/orders/postClosedOrder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: "Closed trade added successfully!" });
        // Reset form except defaults
        setSymbol("");
        setPrice("");
        setClosedLtp("");
        setQuantity("");
        setLots("1");
        setLotSize("1");
        setExpire("");
        setCameFrom("Open");
        
        // Dispatch event so portfolio/orders refresh if active
        window.dispatchEvent(new CustomEvent("orders:changed"));
      } else {
        setFeedback({ type: "error", message: data.error || data.message || "Failed to add trade" });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Network connection error" });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
          <button onClick={handleBack} className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-muted)] hover:text-white transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Add Closed Trade</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4">
        {feedback && (
          <div className={`p-4 rounded-xl border mb-4 flex items-center gap-3 animate-in fade-in duration-200 ${
            feedback.type === "success" 
              ? "bg-[var(--gain-chip-bg)] text-[var(--gain-text)] border-[var(--gain-chip-bg)]/20" 
              : "bg-[var(--loss-chip-bg)] text-[var(--loss-text)] border-[var(--loss-chip-bg)]/20"
          }`}>
            {feedback.type === "success" ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4 shadow-sm">
          {/* Symbol */}
          <div>
            <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Trading Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. NIFTY2681824450CE / RELIANCE"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors uppercase"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Segment */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="NFO">NFO (Options)</option>
                <option value="NSE">NSE (Equity)</option>
                <option value="MCX">MCX (Commodity)</option>
                <option value="BSE">BSE</option>
              </select>
            </div>

            {/* Side */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Side (Entry)</label>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Product */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Product</label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="MIS">MIS (Intraday)</option>
                <option value="NRML">NRML (Overnight)</option>
              </select>
            </div>

            {/* Trade Closed From (came_From) */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Trade Closed From</label>
              <select
                value={cameFrom}
                onChange={(e) => setCameFrom(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="Open">Open Order</option>
                <option value="Hold">Holding</option>
              </select>
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Expiry Date (For Options/Futures)</label>
            <input
              type="date"
              value={expire}
              onChange={(e) => setExpire(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors text-[var(--text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Entry Price */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Entry Price (Avg)</label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Exit Price */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Exit Price (LTP)</label>
              <input
                type="number"
                step="any"
                value={closedLtp}
                onChange={(e) => setClosedLtp(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Qty</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  // Auto calc lots if lotSize is set
                  const sz = Number(lotSize) || 1;
                  const q = Number(e.target.value) || 0;
                  setLots(String(Math.ceil(q / sz) || 1));
                }}
                placeholder="1"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Lots */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Lots</label>
              <input
                type="number"
                value={lots}
                onChange={(e) => {
                  setLots(e.target.value);
                  // Auto calc qty
                  const sz = Number(lotSize) || 1;
                  const l = Number(e.target.value) || 0;
                  setQuantity(String(l * sz));
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Lot Size */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Lot Size</label>
              <input
                type="number"
                value={lotSize}
                onChange={(e) => {
                  setLotSize(e.target.value);
                  // Auto calc qty based on lots
                  const sz = Number(e.target.value) || 1;
                  const l = Number(lots) || 0;
                  setQuantity(String(l * sz));
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Placed At */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Entry Time</label>
              <input
                type="datetime-local"
                value={placedAt}
                onChange={(e) => setPlacedAt(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors text-[var(--text-primary)]"
                required
              />
            </div>

            {/* Closed At */}
            <div>
              <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5">Exit Time</label>
              <input
                type="datetime-local"
                value={closedAt}
                onChange={(e) => setClosedAt(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors text-[var(--text-primary)]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold shadow-lg shadow-indigo-500/20 transition-all duration-200 text-white active:scale-[0.98] pt-4 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Adding Trade...
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5" />
                Add Closed Trade
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
