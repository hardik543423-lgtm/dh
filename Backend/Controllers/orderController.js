import asyncHandler from "express-async-handler";
import Order from "../Model/OrdersModel.js";
import Fund from "../Model/FundModel.js";

import { lmf as dhanSocket } from "../index.js"; // Rename karke use karo taaki code change na karna pade
import {
  addToWatchlist,
  updateTriggerInWatchlist,
  removeFromWatchlist,
} from "../Utils/OrderManager.js";
import { checkOptionLimit, updateOptionUsage, rollbackOptionUsage, resetOptionUsageIfNewDay } from "../Utils/OptionLimitManager.js";
import { checkMcxLimit, updateMcxUsage, rollbackMcxUsage, resetMcxUsageIfNewDay } from "../Utils/McxLimitManager.js";
import { checkMcxOptionLimit, updateMcxOptionUsage, rollbackMcxOptionUsage, resetMcxOptionUsageIfNewDay } from "../Utils/McxOptionLimitManager.js";

const isEtfSymbol = (sym) => {
  const s = String(sym).toUpperCase().trim();
  if (s === "GOLD" || s === "GOLDM" || s === "GOLDPETAL" || s === "SILVER" || s === "SILVERM" || s === "SILVERMIC") {
    return false;
  }
  if (s.includes("ETF") || s.endsWith("ETF") || s.includes("NAV") || s.endsWith("NAV")) {
    return true;
  }
  if (s.endsWith("GOLD") && s !== "GOLD") {
    return true;
  }
  return false;
};

const postOrder = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // ... (Apki purani destructuring aur validations same rahengi) ...
  const {
    broker_id_str,
    customer_id_str,
    instrument_token,  // Kite field (replaces Dhan's security_Id)
    symbol,
    side,
    product,
    price = 0,
    quantity,
    lot_size = 1,
    lots,
    segment = "UNKNOWN",
    jobbin_price,
    jobbin_type = "percentage", // "percentage" or "points"
    came_From, // Extract came_From
    meta = {},
  } = body;

  if (!broker_id_str || !customer_id_str)
    return res
      .status(400)
      .json({ error: "broker_id_str and customer_id_str are required" });
  if (!instrument_token || !symbol)
    return res
      .status(400)
      .json({ error: "instrument_token and symbol are required" });
  if (!side || !["BUY", "SELL"].includes(side))
    return res.status(400).json({ error: "side must be BUY or SELL" });
  if (
    !product ||
    !["MIS", "NRML"].includes(String(product).trim().toUpperCase())
  )
    return res.status(400).json({ error: "product must be MIS or NRML" });

  const productNorm = String(product).trim().toUpperCase();
  const qtyNum = Number(quantity);

  if (!Number.isFinite(qtyNum) || qtyNum <= 0)
    return res
      .status(400)
      .json({ error: "quantity must be a positive number" });
  if (jobbin_price === undefined || jobbin_price === null)
    return res.status(400).json({ error: "enter jobbing price" });

  const isMcxSegment = String(segment).trim().toUpperCase().includes("MCX");
  if (isMcxSegment && isEtfSymbol(symbol)) {
    return res.status(400).json({ error: "You cannot buy this trade for MCX" });
  }

  // ============================================================
  // START: FUND & MARGIN LOGIC — ATOMIC OPERATIONS (Race-Safe)
  // ============================================================

  const requiredMargin = Number(price) * qtyNum;

  // --- STEP 1: Pre-fetch fund for validation checks that need full document ---
  const fundCheck = await Fund.findOne({ broker_id_str, customer_id_str }).lean();

  if (!fundCheck) {
    return res
      .status(404)
      .json({ error: "Fund account not found for this user." });
  }

  const isIntraday = productNorm === "MIS";

  // --- SPECIAL LOGIC: DAILY LIMIT FOR OPTIONS (Normal vs MCX) ---
  const symUpper = String(symbol).toUpperCase();
  const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
  const isMcx = String(segment).trim().toUpperCase().includes("MCX");
  const isMcxOption = isOption && isMcx;
  const isNormalOption = isOption && !isMcx;

  if (isMcxOption) {
    if (body.mcx_option_limit_percentage !== undefined && body.mcx_option_limit_percentage !== null) {
      await Fund.updateOne(
        { broker_id_str, customer_id_str },
        { $set: { mcx_option_limit_percentage: Number(body.mcx_option_limit_percentage) } }
      );
      fundCheck.mcx_option_limit_percentage = Number(body.mcx_option_limit_percentage);
    }

    const freshFund = await resetMcxOptionUsageIfNewDay(broker_id_str, customer_id_str);
    const fundForCheck = freshFund ? freshFund.toObject() : fundCheck;
    if (body.mcx_option_limit_percentage !== undefined && body.mcx_option_limit_percentage !== null) {
      fundForCheck.mcx_option_limit_percentage = Number(body.mcx_option_limit_percentage);
    }

    const limitCheck = checkMcxOptionLimit(fundForCheck, productNorm, requiredMargin);
    if (!limitCheck.allowed) {
      return res.status(400).json({
        error: limitCheck.message
      });
    }
  } else if (isNormalOption) {
    if (body.option_limit_percentage !== undefined && body.option_limit_percentage !== null) {
      await Fund.updateOne(
        { broker_id_str, customer_id_str },
        { $set: { option_limit_percentage: Number(body.option_limit_percentage) } }
      );
      fundCheck.option_limit_percentage = Number(body.option_limit_percentage);
    }

    const freshFund = await resetOptionUsageIfNewDay(broker_id_str, customer_id_str);
    const fundForCheck = freshFund ? freshFund.toObject() : fundCheck;
    if (body.option_limit_percentage !== undefined && body.option_limit_percentage !== null) {
      fundForCheck.option_limit_percentage = Number(body.option_limit_percentage);
    }

    const limitCheck = checkOptionLimit(fundForCheck, productNorm, requiredMargin);
    if (!limitCheck.allowed) {
      return res.status(400).json({
        error: limitCheck.message
      });
    }
  }
  // --------------------------------------------------

  // --- SPECIAL LOGIC: DAILY LIMIT FOR MCX ---
  if (isMcx) {
    if (body.mcx_limit_percentage !== undefined && body.mcx_limit_percentage !== null) {
      await Fund.updateOne(
        { broker_id_str, customer_id_str },
        { $set: { mcx_limit_percentage: Number(body.mcx_limit_percentage) } }
      );
      fundCheck.mcx_limit_percentage = Number(body.mcx_limit_percentage);
    }

    const freshFund = await resetMcxUsageIfNewDay(broker_id_str, customer_id_str);
    const fundForCheck = freshFund ? freshFund.toObject() : fundCheck;
    if (body.mcx_limit_percentage !== undefined && body.mcx_limit_percentage !== null) {
      fundForCheck.mcx_limit_percentage = Number(body.mcx_limit_percentage);
    }

    const limitCheck = checkMcxLimit(fundForCheck, productNorm, requiredMargin);
    if (!limitCheck.allowed) {
      return res.status(400).json({
        error: limitCheck.message
      });
    }
  }
  // --------------------------------------------------

  // --- STEP 2: ATOMIC FUND DEDUCTION (Race-condition proof) ---
  // Uses MongoDB $inc to atomically check balance AND deduct in ONE operation
  // If two concurrent requests hit this, MongoDB serializes the $inc at document level

  let fundUpdateResult;

  if (isIntraday) {
    // Intraday: Check (available - used >= required) AND atomically $inc used_limit
    fundUpdateResult = await Fund.findOneAndUpdate(
      {
        broker_id_str,
        customer_id_str,
        // Atomic check: available_limit - used_limit >= requiredMargin
        $expr: {
          $gte: [
            { $subtract: ["$intraday.available_limit", "$intraday.used_limit"] },
            requiredMargin
          ]
        }
      },
      {
        $inc: {
          "intraday.used_limit": requiredMargin,
          "intraday.free_limit": -requiredMargin
        }
      },
      { new: true }
    );
  } else {
    // Overnight: Check available_limit >= requiredMargin AND atomically $inc (negative = decrease)
    fundUpdateResult = await Fund.findOneAndUpdate(
      {
        broker_id_str,
        customer_id_str,
        "overnight.available_limit": { $gte: requiredMargin }
      },
      {
        $inc: {
          "overnight.available_limit": -requiredMargin,
          "overnight.free_limit": -requiredMargin
        }
      },
      { new: true }
    );
  }

  if (!fundUpdateResult) {
    // Atomic check failed = insufficient funds
    const availableLimit = isIntraday
      ? (fundCheck.intraday?.available_limit || 0) - (fundCheck.intraday?.used_limit || 0)
      : (fundCheck.overnight?.available_limit || 0);
    return res.status(400).json({
      error: `Insufficient Funds! Required: ${requiredMargin.toFixed(
        2
      )}, Available: ${availableLimit.toFixed(2)}`,
    });
  }

  // --- STEP 3: Update Option Usage (if applicable) ---
  if (isMcxOption) {
    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    updateMcxOptionUsage(fund, productNorm, requiredMargin);
    await fund.save();
  } else if (isNormalOption) {
    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    updateOptionUsage(fund, productNorm, requiredMargin);
    await fund.save();
  }

  // --- STEP 4: Update MCX Usage (if applicable) ---
  if (isMcx) {
    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    updateMcxUsage(fund, productNorm, requiredMargin);
    await fund.save();
  }

  // ============================================================
  // END: FUND LOGIC (Atomic — no race condition)
  // ============================================================

  // ... (Create Order Object - Same as before) ...
  const orderDoc = new Order({
    broker_id_str: String(broker_id_str),
    customer_id_str: String(customer_id_str),
    instrument_token: String(instrument_token),  // Kite field
    symbol: String(symbol),
    segment: String(segment),
    side,
    product: productNorm,
    order_status: productNorm === "MIS" ? "OPEN" : null,
    price: Number(price) || 0,
    quantity: qtyNum,
    lot_size: Number(lot_size) || 1,
    lots,
    increase_price: Number(jobbin_price) || 0,
    jobbing_point: 0,  // Always 0 at creation, meant ONLY for exit-time manual tweak
    jobbin_type: ["percentage", "points"].includes(jobbin_type) ? jobbin_type : "percentage",
    margin_blocked: requiredMargin, // Save blocked margin
    came_From: came_From || "Open", // Default to "Open" if not provided
    meta: meta || {},
    placed_at: new Date(),
  });

  try {
    const saved = await orderDoc.save();

    // Add to RAM (For Auto-Exit)
    addToWatchlist(saved);
    // Subscribe using instrument_token for Kite WebSocket
    dhanSocket.subscribe([
      { instrument_token: saved.instrument_token },
    ]);

    return res.json({ ok: true, message: "Order saved", order: saved });
  } catch (error) {
    // --- ROLLBACK FUND (Atomic Refund if Order Save Fails) ---
    if (isIntraday) {
      await Fund.updateOne(
        { broker_id_str, customer_id_str },
        {
          $inc: {
            "intraday.used_limit": -requiredMargin,
            "intraday.free_limit": requiredMargin
          }
        }
      );
    } else {
      await Fund.updateOne(
        { broker_id_str, customer_id_str },
        {
          $inc: {
            "overnight.available_limit": requiredMargin,
            "overnight.free_limit": requiredMargin
          }
        }
      );
    }

    // Rollback Option Limit
    if (isMcxOption) {
      const fund = await Fund.findOne({ broker_id_str, customer_id_str });
      if (fund) {
        rollbackMcxOptionUsage(fund, productNorm, requiredMargin);
        await fund.save();
      }
    } else if (isNormalOption) {
      const fund = await Fund.findOne({ broker_id_str, customer_id_str });
      if (fund) {
        rollbackOptionUsage(fund, productNorm, requiredMargin);
        await fund.save();
      }
    }

    // Rollback MCX Limit
    if (isMcx) {
      const fund = await Fund.findOne({ broker_id_str, customer_id_str });
      if (fund) {
        rollbackMcxUsage(fund, productNorm, requiredMargin);
        await fund.save();
      }
    }

    return res
      .status(500)
      .json({ error: "Order creation failed: " + error.message });
  }
});

const getOrderInstrument = asyncHandler(async (req, res) => {
  const source =
    req.method === "GET" && req.query && Object.keys(req.query).length
      ? req.query
      : req.body || {};
  const { broker_id_str, customer_id_str, orderStatus, product, id, order_id } = source || {};
  const order_status =
    typeof orderStatus === "string" ? orderStatus.trim().toUpperCase() : "";
  const productIn =
    typeof product === "string" ? product.trim().toUpperCase() : "";

  const filter = {};
  if (broker_id_str) filter.broker_id_str = String(broker_id_str);
  if (customer_id_str) filter.customer_id_str = String(customer_id_str);
  if (id) filter._id = String(id);
  if (order_id) filter.order_id = String(order_id);
  // If caller requested a specific product (MIS or NRML), apply filter

  if (productIn && ["MIS", "NRML"].includes(productIn)) {
    filter.product = productIn;
  } // Default behavior: if caller doesn't specify orderStatus, return only OPEN orders // BUT when caller asked for NRML/overnight (`product=NRML`), do NOT filter by order_status (NRML orders keep order_status null).

  if (String(productIn).toUpperCase() === "NRML") {
    // 🎯 FIX: For NRML, filter out explicitly CLOSED orders, keeping only active/null status.
    filter.order_status = { $ne: "CLOSED" };
  } else {
    if (order_status) {
      // allow special value 'ALL' to bypass filtering
      if (String(order_status).toUpperCase() !== "ALL") {
        filter.order_status = String(order_status);
      }
    } else {
      filter.order_status = "OPEN";
    }
  }

  try {
    const ordersInstrument = await Order.find(filter).lean();
    return res.json({ ok: true, ordersInstrument });
  } catch (err) {
    console.error("getOrderInstrument error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch orders" });
  }
});

const updateOrder = asyncHandler(async (req, res) => {
  const {
    broker_id_str,
    customer_id_str,
    order_id,
    instrument_token,  // Kite field
    symbol,
    side,
    product,
    quantity,
    lots,
    price,
    order_status,
    segment,
    closed_ltp,
    closed_at,
    came_From,
    stop_loss,
    target,
    ...rest
  } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ success: false, message: 'order_id is required' });
  }

  // Update Object Creation
  const update = {};

  if (quantity) update.quantity = Number(quantity);
  if (lots) update.lots = Number(lots);
  if (price && order_status !== 'CLOSED') update.price = Number(price);
  if (order_status) update.order_status = order_status;
  if (closed_ltp) update.closed_ltp = Number(closed_ltp);
  if (closed_at) update.closed_at = closed_at;
  if (req.body.placed_at) update.placed_at = req.body.placed_at;

  // 👇 Fix: Add came_From to update object
  if (came_From) update.came_From = String(came_From).trim();

  // 👇 SL/Target update
  if (stop_loss !== undefined) update.stop_loss = Number(stop_loss);
  if (target !== undefined) update.target = Number(target);
  // Jobbing Point and Customer Exit Price updates with mutual exclusivity logic
  if (req.body.customer_exit_price !== undefined) {
    const custPrice = Number(req.body.customer_exit_price);
    update.customer_exit_price = custPrice;
    if (custPrice > 0) {
      update.jobbing_point = 0;
      update.jobbing_applied_ltp = 0;
    }
  }

  if (req.body.jobbing_point !== undefined) {
    const jpValue = Number(req.body.jobbing_point);
    update.jobbing_point = jpValue;
    if (jpValue > 0) {
      update.customer_exit_price = 0;
    }
  }
  if (req.body.jobbing_applied_ltp !== undefined) {
    update.jobbing_applied_ltp = Number(req.body.jobbing_applied_ltp);
  }

  update.updatedAt = new Date();

  try {
    // 1. Find Existing Order
    let existing = await Order.findOne({ order_id: order_id });
    if (!existing) existing = await Order.findById(order_id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 2. Find Fund
    const fund = await Fund.findOne({
      broker_id_str: existing.broker_id_str,
      customer_id_str: existing.customer_id_str
    });

    if (!fund) {
      return res.status(404).json({ success: false, message: "Fund account not found" });
    }


    const currentProduct = update.product || existing.product;
    const currentStatus = update.order_status || existing.order_status;
    const isHold = currentStatus === 'HOLD';
    const isIntraday = String(currentProduct).trim().toUpperCase() === 'MIS' || isHold;


    const existingIsIntraday = String(existing.product).trim().toUpperCase() === 'MIS';

    // Transition from RESTRICTED to OPEN: check and block margin again
    if (update.order_status === 'OPEN' && existing.order_status === 'RESTRICTED') {
      const calcPrice = existing.price;
      const marginToDeduct = existing.quantity * calcPrice;

      if (marginToDeduct > 0) {
        let availableLimit = 0;
        let currentUsed = 0;

        if (isIntraday) {
          availableLimit = fund.intraday.available_limit;
          currentUsed = fund.intraday.used_limit;
        } else {
          availableLimit = fund.overnight.available_limit;
          currentUsed = 0;
        }

        const freeLimit = availableLimit - currentUsed;

        if (marginToDeduct > freeLimit) {
          return res.status(400).json({
            success: false,
            message: `Insufficient Funds to Re-open! Required: ${marginToDeduct.toFixed(2)}, Available: ${freeLimit.toFixed(2)}`
          });
        }

        // Option limit check
        const exSymUpper = String(existing.symbol).toUpperCase();
        const isOption = (exSymUpper.endsWith("CE") || exSymUpper.endsWith("PE") || exSymUpper.endsWith("CALL") || exSymUpper.endsWith("PUT"));
        if (isOption) {
          await resetOptionUsageIfNewDay(existing.broker_id_str, existing.customer_id_str);
          const freshFund = await Fund.findOne({ broker_id_str: existing.broker_id_str, customer_id_str: existing.customer_id_str });
          const limitCheck = checkOptionLimit(freshFund || fund, currentProduct, marginToDeduct);
          if (!limitCheck.allowed) {
            return res.status(400).json({ success: false, message: limitCheck.message });
          }
          updateOptionUsage(freshFund || fund, currentProduct, marginToDeduct);
          if (freshFund) await freshFund.save();
        }

        // MCX limit check
        const isMcx = String(existing.segment).trim().toUpperCase().includes("MCX");
        if (isMcx) {
          await resetMcxUsageIfNewDay(existing.broker_id_str, existing.customer_id_str);
          const freshFund = await Fund.findOne({ broker_id_str: existing.broker_id_str, customer_id_str: existing.customer_id_str });
          const limitCheck = checkMcxLimit(freshFund || fund, currentProduct, marginToDeduct);
          if (!limitCheck.allowed) {
            return res.status(400).json({ success: false, message: limitCheck.message });
          }
          updateMcxUsage(freshFund || fund, currentProduct, marginToDeduct);
          if (freshFund) await freshFund.save();
        }

        // Block margin again
        if (isIntraday) {
          fund.intraday.used_limit += marginToDeduct;
          fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
        } else {
          fund.overnight.available_limit -= marginToDeduct;
          fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
        }

        update.margin_blocked = marginToDeduct;
      }
    }


    if (update.quantity && update.quantity > existing.quantity && existing.order_status !== 'CLOSED') {

      const newQty = Number(update.quantity);
      const calcPrice = update.price ? Number(update.price) : Number(existing.price);

      const oldMargin = existing.margin_blocked || (existing.quantity * existing.price);
      const newTotalMargin = newQty * calcPrice;

      const marginToDeduct = newTotalMargin - oldMargin;

      if (marginToDeduct > 0) {

        let availableLimit = 0;
        let currentUsed = 0;

        if (isIntraday) {

          availableLimit = fund.intraday.available_limit;
          currentUsed = fund.intraday.used_limit;
        } else {
          // Overnight Logic (Direct Cash)
          availableLimit = fund.overnight.available_limit;
          currentUsed = 0;
        }

        const freeLimit = availableLimit - currentUsed;

        if (marginToDeduct > freeLimit) {
          return res.status(400).json({
            success: false,
            message: `Insufficient Funds! Required: ${marginToDeduct.toFixed(2)}, Available: ${freeLimit.toFixed(2)}`
          });
        }

        // --- 10% OPTION LIMIT CHECK (Update Scenario) ---
        const exSymUpper = String(existing.symbol).toUpperCase();
        const isOptionUpdate = (exSymUpper.endsWith("CE") || exSymUpper.endsWith("PE") || exSymUpper.endsWith("CALL") || exSymUpper.endsWith("PUT"));
        if (isOptionUpdate) {
          // Reset option usage if new day (persists to DB)
          await resetOptionUsageIfNewDay(existing.broker_id_str, existing.customer_id_str);
          // Re-read fund to get fresh used_today after reset
          const freshFund = await Fund.findOne({ broker_id_str: existing.broker_id_str, customer_id_str: existing.customer_id_str });
          const limitCheck = checkOptionLimit(freshFund || fund, currentProduct, marginToDeduct);
          if (!limitCheck.allowed) {
            // Slight change: message might refer to "Required" which here implies "Additional Required"
            return res.status(400).json({
              success: false,
              message: limitCheck.message.replace('Required:', 'Additional Required:')
            });
          }

          updateOptionUsage(freshFund || fund, currentProduct, marginToDeduct);
          if (freshFund) await freshFund.save();
        }
        // -----------------------------------------------

        // --- MCX LIMIT CHECK (Update Scenario) ---
        const isMcxUpdate = String(segment || existing.segment).trim().toUpperCase().includes("MCX");
        if (isMcxUpdate) {
          await resetMcxUsageIfNewDay(existing.broker_id_str, existing.customer_id_str);
          const freshFund = await Fund.findOne({ broker_id_str: existing.broker_id_str, customer_id_str: existing.customer_id_str });
          const limitCheck = checkMcxLimit(freshFund || fund, currentProduct, marginToDeduct);
          if (!limitCheck.allowed) {
            return res.status(400).json({
              success: false,
              message: limitCheck.message.replace('Required:', 'Additional Required:')
            });
          }

          updateMcxUsage(freshFund || fund, currentProduct, marginToDeduct);
          if (freshFund) await freshFund.save();
        }
        // -----------------------------------------------

        // *** UPDATE FUND ***
        if (isIntraday) {
          // Intraday/HOLD: Increase Used Limit
          fund.intraday.used_limit += marginToDeduct;
          fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
        } else {
          // Overnight (NRML): Decrease Available Limit
          fund.overnight.available_limit -= marginToDeduct;
          fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
        }

        // Record new total margin
        update.margin_blocked = newTotalMargin;
      }
    }


    else if (update.order_status === 'HOLD' && existing.order_status === 'OPEN' && existingIsIntraday) {
      // Do not touch fund limits; only clear margin on the order
      update.margin_blocked = 0;
    }


    else if ((update.order_status === 'CLOSED' || update.order_status === 'RESTRICTED') && existing.order_status !== 'CLOSED' && existing.order_status !== 'RESTRICTED') {
      const marginToRelease = existing.margin_blocked || (existing.price * existing.quantity);

      if (marginToRelease > 0) {
        // Release margin back to available/used limit on RESTRICTED or CLOSED (Exit)
        if (isIntraday) {
          fund.intraday.used_limit -= marginToRelease;
          if (fund.intraday.used_limit < 0) fund.intraday.used_limit = 0;
          fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
        } else {
          fund.overnight.available_limit += marginToRelease;
          fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
        }

        // Release Option & MCX limits
        const symUpper = String(existing.symbol).toUpperCase();
        const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
        const isMcx = String(existing.segment || segment).trim().toUpperCase().includes("MCX");
        const isMcxOption = isOption && isMcx;
        const isNormalOption = isOption && !isMcx;
        const productNorm = String(existing.product).trim().toUpperCase();

        if (isMcxOption) {
          rollbackMcxOptionUsage(fund, productNorm, marginToRelease);
        } else if (isNormalOption) {
          rollbackOptionUsage(fund, productNorm, marginToRelease);
        }

        if (isMcx) {
          rollbackMcxUsage(fund, productNorm, marginToRelease);
        }
      }

      // --- 📈 AUTO P&L CALCULATION (ONLY FOR CLOSED, NOT RESTRICTED) ---
      if (update.order_status === 'CLOSED') {
        const entryPrice = existing.price;
        const exitPrice = update.closed_ltp || closed_ltp || existing.closed_ltp;
        const quantity = existing.quantity;

        if (exitPrice > 0) {
          let pnl = 0;
          if (existing.side === 'BUY') {
            pnl = (exitPrice - entryPrice) * quantity;
          } else {
            pnl = (entryPrice - exitPrice) * quantity;
          }
          // fund.net_pnl = (fund.net_pnl || 0) + pnl;
          console.log(`[updateOrder] P&L Calculated: ${pnl.toFixed(2)} (Side: ${existing.side}, Entry: ${entryPrice}, Exit: ${exitPrice}, Qty: ${quantity})`);
        }
      }

      // Clear margin on DB as well
      update.margin_blocked = 0;
    }

    await fund.save();


    const updated = await Order.findByIdAndUpdate(existing._id, { $set: update }, { new: true, runValidators: true });

    if (!updated) {
      return res.status(500).json({ success: false, message: 'Failed to update order' });
    }

    // 👇 Update Watchlist (Auto-Exit System - removes if CLOSED/RESTRICTED, updates if active)
    updateTriggerInWatchlist(updated);

    return res.status(200).json({ success: true, message: 'Order updated', order: updated });

  } catch (err) {
    console.error('[updateOrder] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});


// NOTE: Frontend se ab hum 'PUT' request bhejenge
// ⚡ PERFORMANCE: Uses bulkWrite instead of sequential saves (O(1) vs O(n) DB calls)
const exitAllOpenOrder = asyncHandler(async (req, res) => {
  const { broker_id_str, customer_id_str } = req.query;
  const { closed_ltp_map, closed_at } = req.body || {};

  if (!broker_id_str || !customer_id_str) {
    res.status(400);
    throw new Error("Missing Broker ID or Customer ID");
  }

  // Fetch open intraday orders (lean for speed — we don't need Mongoose docs)
  const openOrders = await Order.find({
    broker_id_str,
    customer_id_str,
    order_status: "OPEN",
    order_category: "INTRADAY",
  }).lean();

  if (!openOrders || openOrders.length === 0) {
    return res.status(200).json({
      success: false,
      message: "No open Intraday orders found to exit.",
    });
  }

  // Fetch fund once
  const fund = await Fund.findOne({ broker_id_str, customer_id_str });

  if (!fund) {
    const failed = openOrders.map(o => ({ id: o._id, status: "Failed", error: "Fund account not found" }));
    return res.status(404).json({
      success: false,
      message: "Fund account not found for this broker/customer.",
      details: failed,
    });
  }

  // ⚡ BULK WRITE: Prepare all order updates in one batch (instead of N sequential saves)
  const bulkOps = [];
  const results = [];
  let totalMarginToRelease = 0;
  let totalPnl = 0;
  const closeTime = closed_at || new Date();

  for (const order of openOrders) {
    removeFromWatchlist(order._id, order.instrument_token || order.security_Id);
    const exitPrice = closed_ltp_map ? closed_ltp_map[order._id] : 0;
    const marginToRelease = Number(order.margin_blocked || (order.price * order.quantity) || 0);

    let finalExitPrice = Number(exitPrice);

    const custExitPrice = Number(order.customer_exit_price) || 0;
    if (custExitPrice > 0) {
      finalExitPrice = custExitPrice;
    } else {
      // Apply Jobbing Point (₹ amount)
      const refLtp = Number(order.jobbing_applied_ltp || 0) || finalExitPrice;
      finalExitPrice = refLtp;
      const jpValue = Number(order.jobbing_point || 0);
      if (jpValue > 0 && finalExitPrice > 0) {
        finalExitPrice = order.side === 'BUY' ? finalExitPrice - jpValue : finalExitPrice + jpValue;
      }
    }

    const closedLtp = finalExitPrice > 0 ? Number(finalExitPrice.toFixed(4)) : 0;

    // Calculate P&L
    if (closedLtp > 0) {
      const pnl = order.side === 'BUY'
        ? (closedLtp - order.price) * order.quantity
        : (order.price - closedLtp) * order.quantity;
      totalPnl += pnl;
    }

    totalMarginToRelease += marginToRelease;

    // Release Option & MCX limits
    const symUpper = String(order.symbol).toUpperCase();
    const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
    const isMcx = String(order.segment).trim().toUpperCase().includes("MCX");
    const isMcxOption = isOption && isMcx;
    const isNormalOption = isOption && !isMcx;
    const productNorm = String(order.product).trim().toUpperCase();

    if (isMcxOption) {
      rollbackMcxOptionUsage(fund, productNorm, marginToRelease);
    } else if (isNormalOption) {
      rollbackOptionUsage(fund, productNorm, marginToRelease);
    }

    if (isMcx) {
      rollbackMcxUsage(fund, productNorm, marginToRelease);
    }

    // Add to bulk operation batch
    bulkOps.push({
      updateOne: {
        filter: { _id: order._id },
        update: {
          $set: {
            order_status: "CLOSED",
            closed_at: closeTime,
            closed_ltp: closedLtp,
            margin_blocked: 0,
            updatedAt: new Date(),
          }
        }
      }
    });

    results.push({ id: order._id, status: "Success", exit_price: exitPrice, released: marginToRelease });
  }

  try {
    // ⚡ ONE database call instead of N — massive speedup for 50+ orders
    if (bulkOps.length > 0) {
      await Order.bulkWrite(bulkOps);
    }

    // Release margin on exit-all and sync free_limit
    fund.intraday = fund.intraday || { used_limit: 0, available_limit: 0 };
    fund.intraday.used_limit = Math.max(0, Number(fund.intraday.used_limit || 0) - totalMarginToRelease);
    fund.intraday.free_limit = Math.max(0, Number(fund.intraday.available_limit || 0) - fund.intraday.used_limit);
    await fund.save();

  } catch (err) {
    console.error("Failed to bulk update orders/fund:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update orders/fund during exit-all",
      details: results,
      error: err.message,
    });
  }

  res.status(200).json({
    success: true,
    message: `Processed ${results.length} orders`,
    details: results,
  });
});


const deleteOrder = asyncHandler(async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ success: false, message: "Order ID required" });
  }

  try {
    // Find first to get margin info before deleting
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ⚡ FIX: Release blocked margin before deleting (was missing — fund leak bug)
    if (order.order_status !== 'CLOSED' && order.margin_blocked > 0) {
      const fund = await Fund.findOne({
        broker_id_str: order.broker_id_str,
        customer_id_str: order.customer_id_str
      });

      if (fund) {
        const isIntraday = String(order.product).trim().toUpperCase() === 'MIS';
        if (isIntraday) {
          fund.intraday.used_limit = Math.max(0, (fund.intraday.used_limit || 0) - order.margin_blocked);
          fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
        } else {
          fund.overnight.available_limit = (fund.overnight.available_limit || 0) + order.margin_blocked;
          fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
        }

        // Release Option & MCX limits
        const symUpper = String(order.symbol).toUpperCase();
        const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
        const isMcx = String(order.segment).trim().toUpperCase().includes("MCX");
        const isMcxOption = isOption && isMcx;
        const isNormalOption = isOption && !isMcx;
        const productNorm = String(order.product).trim().toUpperCase();

        if (isMcxOption) {
          rollbackMcxOptionUsage(fund, productNorm, order.margin_blocked);
        } else if (isNormalOption) {
          rollbackOptionUsage(fund, productNorm, order.margin_blocked);
        }

        if (isMcx) {
          rollbackMcxUsage(fund, productNorm, order.margin_blocked);
        }

        await fund.save();
      }
    }

    removeFromWatchlist(order._id, order.instrument_token || order.security_Id);
    await Order.findByIdAndDelete(order_id);
    return res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete order" });
  }
});

const deleteAllClosedOrders = asyncHandler(async (req, res) => {
  const { broker_id_str, customer_id_str } = req.body;

  if (!broker_id_str || !customer_id_str) {
    return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
  }

  try {
    const result = await Order.deleteMany({
      broker_id_str,
      customer_id_str,
      order_status: "CLOSED"
    });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} orders deleted successfully`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete all orders" });
  }
});

const updateClosedOrderPrices = asyncHandler(async (req, res) => {
  const { order_id, price, closed_ltp, closed_at, placed_at, quantity } = req.body;

  if (!order_id) {
    return res.status(400).json({ success: false, message: "Order ID required" });
  }

  // Find order
  const order = await Order.findById(order_id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Update logic: Only update if new values are provided
  if (price !== undefined && price !== null) {
    order.price = Number(price);
    order.average_price = Number(price); // Usually same for manual correction
  }

  if (closed_ltp !== undefined && closed_ltp !== null) {
    order.closed_ltp = Number(closed_ltp);
  }

  if (closed_at !== undefined && closed_at !== null) {
    order.closed_at = closed_at;
  }

  if (placed_at !== undefined && placed_at !== null) {
    order.placed_at = placed_at;
  }

  if (quantity !== undefined && quantity !== null) {
    const newQty = Number(quantity);
    order.quantity = newQty;
    const lotSize = order.lot_size || 1;
    order.lots = Math.ceil(newQty / lotSize);
  }

  // We are NOT recalculating funds here as this is a manual correction for CLOSED orders.
  // Assuming this is strictly for record-keeping fixes as requested.

  order.updatedAt = new Date();
  await order.save();

  return res.status(200).json({ success: true, message: "Prices updated successfully", order });
});

const postClosedOrder = asyncHandler(async (req, res) => {
  const {
    broker_id_str,
    customer_id_str,
    symbol,
    segment = "NSE",
    side,
    product = "MIS",
    price = 0,        // Entry price
    closed_ltp = 0,   // Exit price
    quantity,
    lots = 1,
    lot_size = 1,
    instrument_token = "0", // Fallback to 0 if not provided
    placed_at,
    closed_at,
    expire,
    came_From,
    meta = {}
  } = req.body;

  if (!broker_id_str || !customer_id_str) {
    return res.status(400).json({ error: "broker_id_str and customer_id_str are required" });
  }
  if (!symbol) {
    return res.status(400).json({ error: "symbol is required" });
  }
  if (!side || !["BUY", "SELL"].includes(side)) {
    return res.status(400).json({ error: "side must be BUY or SELL" });
  }

  const qty = Number(quantity) || (Number(lots) * Number(lot_size)) || 1;
  const entryPrice = Number(price) || 0;
  const exitPrice = Number(closed_ltp) || 0;

  const orderData = {
    broker_id_str,
    customer_id_str,
    instrument_token: String(instrument_token),
    symbol: String(symbol).toUpperCase().trim(),
    segment: String(segment).toUpperCase().trim(),
    side: String(side).toUpperCase(),
    product: String(product).toUpperCase(),
    price: entryPrice,
    closed_ltp: exitPrice,
    quantity: qty,
    lots: Number(lots) || 1,
    lot_size: Number(lot_size) || 1,
    order_status: "CLOSED",
    placed_at: placed_at ? new Date(placed_at) : new Date(),
    closed_at: closed_at ? new Date(closed_at) : new Date(),
    came_From: came_From || "Open",
    expire: expire ? new Date(expire) : null,
    meta: { ...meta, from: "broker_manual_form" }
  };

  const newOrder = new Order(orderData);
  await newOrder.save();

  return res.status(200).json({ success: true, message: "Manual closed order created successfully", order: newOrder });
});

export { getOrderInstrument, postOrder, updateOrder, exitAllOpenOrder, deleteOrder, deleteAllClosedOrders, updateClosedOrderPrices, postClosedOrder };