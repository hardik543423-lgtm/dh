import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    // --- Who placed and for whom ---
    broker_id_str: { type: String, index: true, required: true }, // "5852270733"
    // broker_mongo_id: { type: mongoose.Types.ObjectId, index: true },    // optional
    customer_id_str: { type: String, index: true, required: true }, // your customer_id

    // --- What to trade ---
    instrument_token: { type: String, index: true, required: true }, // Kite instrument token
    symbol: { type: String, required: true }, // e.g. "RELIANCE" / "NIFTY24NOV19500CE"
    segment: { type: String, require: true },
    // exchange: { type: String, required: true },                      // optional for now

    // --- Order intent ---
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    // order_type: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
    closed_ltp: { type: Number },
    product: { type: String, enum: ["MIS", "NRML"], required: true }, // intraday vs overnight
    price: { type: Number, default: 0 }, // limit price; MARKET => 0
    expire: { type: Date },
    came_From: { type: String, enum: ["Open", "Overnight", "Hold"] },
    // trigger_price: { type: Number, default: 0 },                     // future SL use

    // --- Quantity (store absolute quantity in shares; also keep lots for F&O UI) ---
    quantity: { type: Number, required: true, min: 1 }, // abs qty = lots * lot_size
    lots: { type: Number, default: 0 }, // UI display only
    lot_size: { type: Number, default: 1 }, // snapshot from instrument
    brokerage: { type: Number, default: 0.01 },
    stop_loss: {
      type: Number,
      default: 0,
      index: true,
    },

    target: {
      type: Number,
      default: 0,
      index: true,
    },

    // Ye field record karega ki order kyu close hua (SL Hit, Target Hit, ya Manual)
    exit_reason: {
      type: String,
      default: null
    },

    // Agar pehle add nahi kiya tha, to ye bhi ensure kar lo (Fund logic ke liye)
    margin_blocked: {
      type: Number,
      default: 0
    },

    // --- Execution summary ---
    filled_qty: { type: Number, default: 0 },
    avg_fill_price: { type: Number, default: 0 },

    // --- New: UI buckets / tags ---
    // Open/Closed == UI filter; CLOSED when fully filled/cancelled/rejected
    order_status: {
      type: String,
      enum: ["OPEN", "CLOSED", "HOLD", "RESTRICTED"],
      default: "OPEN",
      index: true,
    },

    // Intraday  Overnight / Holding == UI category
    // Default: MIS => INTRADAY, NRML => OVERNIGHT
    order_category: {
      type: String,
      enum: ["INTRADAY", "OVERNIGHT", "HOLDING"],
      index: true,
      default: function () {
        return this.product === "MIS" ? "INTRADAY" : "OVERNIGHT";
      },
    },

    // --- New: increase_price (jobbing %). Allow decimals (e.g. 0.08)
    increase_price: {
      type: Number,
      default: 0,
      validate: {
        validator: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
        message: "increase_price must be a non-negative number",
      },
    },

    // --- Jobbing type: "percentage" (default, existing behavior) or "points" (fixed ₹ amount) ---
    jobbin_type: {
      type: String,
      enum: ["percentage", "points"],
      default: "percentage",
    },

    // --- Jobbing Point: separate exit-time deduction/addition (₹ flat value) ---
    // BUY exit: closed_ltp = LTP - jobbing_point
    // SELL exit: closed_ltp = LTP + jobbing_point
    jobbing_point: {
      type: Number,
      default: 0,
    },

    // LTP at the time the jobbing point was set/saved
    jobbing_applied_ltp: {
      type: Number,
      default: 0,
    },

    // Fixed exit price set by broker for the customer
    customer_exit_price: {
      type: Number,
      default: 0,
    },

    // --- Broker/Exchange references (real execution mode) ---
    broker_order_id: { type: String, index: true },
    exchange_order_id: { type: String, index: true },
    // reason: { type: String }, // rejection/cancel reason

    // --- Risk snapshot (optional but useful) ---
    // margin_blocked is already defined at line ~50, not duplicated here
    notional_value: { type: Number, default: 0 },

    // --- Audit ---
    placed_at: { type: Date },
    closed_at: { type: Date },
    updated_at: { type: Date },
    meta: { type: Object, default: {} }, // free-form (ui/device/ip etc.)
  },
  { timestamps: true }
);

// helpful compound index for queries by customer + instrument + time
OrderSchema.index({ customer_id_str: 1, instrument_token: 1, createdAt: -1 });

// compound index for fast order lookups by broker + customer + status
OrderSchema.index({ broker_id_str: 1, customer_id_str: 1, order_status: 1 });

// compound index for product-based filtering
OrderSchema.index({ broker_id_str: 1, customer_id_str: 1, product: 1, order_status: 1 });

// Safety: ensure category default aligns with product if not set explicitly
OrderSchema.pre("save", function (next) {
  if (!this.order_category) {
    this.order_category = this.product === "MIS" ? "INTRADAY" : "OVERNIGHT";
  }
  next();
});

export default mongoose.model("Order", OrderSchema);