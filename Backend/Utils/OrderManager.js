import Order from '../Model/OrdersModel.js';
import Fund from '../Model/FundModel.js';
import { rollbackOptionUsage } from './OptionLimitManager.js';
import { rollbackMcxUsage } from './McxLimitManager.js';
import { rollbackMcxOptionUsage } from './McxOptionLimitManager.js';

// =========================================================
// 1. GLOBAL MEMORY (RAM) - THE WATCHLIST
// Key   = Instrument Token (String)
// Value = Map of OrderId -> TriggerData
// =========================================================
export const activeTriggers = new Map();

/**
 * =========================================================
 * 2. INITIALIZATION (SERVER STARTUP)
 * Server restart hone par DB se wo saare orders load karo jo CLOSED nahi hain.
 * Covers: 'OPEN', 'HOLD', and null (Overnight)
 * =========================================================
 */
export const loadOpenOrders = async () => {
    try {
        console.log("🔄 [OrderManager] Loading active triggers...");

        // LOGIC: Status 'CLOSED' aur 'RESTRICTED' nahi hona chahiye + SL ya Target set hona chahiye
        const activeOrders = await Order.find({
            order_status: { $nin: ['CLOSED', 'RESTRICTED'] }, // Means: OPEN, HOLD, or null
            $or: [
                { stop_loss: { $exists: true, $ne: null, $gt: 0 } },
                { target: { $exists: true, $ne: null, $gt: 0 } }
            ]
        });

        activeTriggers.clear();

        activeOrders.forEach(order => {
            addToWatchlist(order);
        });

        console.log(`✅ [OrderManager] System Ready. Tracking ${activeOrders.length} active orders.`);
    } catch (error) {
        console.error("❌ [OrderManager] Failed to load orders:", error);
    }
};

export const removeFromWatchlist = (orderId, token) => {
    if (!orderId) return;
    const orderIdStr = String(orderId);

    if (token) {
        const tokenStr = String(token);
        if (activeTriggers.has(tokenStr)) {
            const ordersMap = activeTriggers.get(tokenStr);
            ordersMap.delete(orderIdStr);
            if (ordersMap.size === 0) {
                activeTriggers.delete(tokenStr);
            }
            return;
        }
    }

    // Fallback: search across all tokens in watchlist
    for (const [t, ordersMap] of activeTriggers.entries()) {
        if (ordersMap.has(orderIdStr)) {
            ordersMap.delete(orderIdStr);
            if (ordersMap.size === 0) {
                activeTriggers.delete(t);
            }
            break;
        }
    }
};

/**
 * =========================================================
 * 3. ADD ORDER TO MEMORY
 * Helper function to push order into RAM
 * =========================================================
 */
export const addToWatchlist = (order) => {
    if (!order) return;
    // 1. Agar Order CLOSED ya RESTRICTED hai to ignore karo (no TP/SL tracking for closed orders)
    if (order.order_status === 'CLOSED' || order.order_status === 'RESTRICTED') return;

    // Use instrument_token for Kite (fallback to security_Id for backward compatibility)
    const token = String(order.instrument_token || order.security_Id);
    const sl = Number(order.stop_loss) || 0;
    const target = Number(order.target) || 0;

    // 2. Agar SL aur Target dono 0 hain, to track karne ka fayda nahi
    if (sl === 0 && target === 0) return;

    if (!activeTriggers.has(token)) {
        activeTriggers.set(token, new Map());
    }

    // 3. Store only necessary data
    const triggerData = {
        orderId: String(order._id),
        symbol: order.symbol,
        segment: order.segment,
        side: order.side,          // 'BUY' or 'SELL'
        sl: sl,
        target: target,
        increase_price: Number(order.increase_price) || 0,
        jobbin_type: order.jobbin_type || 'percentage',
        jobbing_point: Number(order.jobbing_point) || 0,
        jobbing_applied_ltp: Number(order.jobbing_applied_ltp) || 0,
        customer_exit_price: Number(order.customer_exit_price) || 0,
        status: order.order_status,
        broker_id_str: order.broker_id_str,
        customer_id_str: order.customer_id_str,
        product: order.product,
        margin_blocked: order.margin_blocked,
        price: order.price,
        quantity: order.quantity
    };

    activeTriggers.get(token).set(triggerData.orderId, triggerData);
    // console.log(`➕ Monitoring: ${order.symbol} | SL: ${sl} | TGT: ${target}`);
};

/**
 * =========================================================
 * 4. UPDATE ORDER IN MEMORY
 * Jab user Modify kare (SL change kare) ya Status change ho
 * =========================================================
 */
export const updateTriggerInWatchlist = (order) => {
    if (!order) return;
    const token = String(order.instrument_token || order.security_Id || "");
    const orderIdStr = String(order._id);

    // Step 1: Purana entry hatao (taaki closed/stale entries na rahein)
    removeFromWatchlist(orderIdStr, token);

    // Step 2: Agar abhi bhi CLOSED aur RESTRICTED nahi hai, to wapas add karo
    if (order.order_status !== 'CLOSED' && order.order_status !== 'RESTRICTED') {
        addToWatchlist(order);
    }
};

/**
 * =========================================================
 * 5. EXECUTE EXIT (DB UPDATE ONLY)
 * Jab SL ya Target Hit ho jaye
 * =========================================================
 */
const executeExit = async (orderData, exitPrice, reason) => {
    const { orderId, token } = orderData;

    console.log(`⚡ [OrderManager] Trigger Hit! Order: ${orderId}, Reason: ${reason}, Price: ${exitPrice}`);

    try {
        // A. Remove from Memory IMMEDIATELY (Prevent Double Execution)
        removeFromWatchlist(orderId, token);

        // B. Update Order Status in Database
        let finalExitPrice = Number(exitPrice);

        const custExitPrice = Number(orderData.customer_exit_price) || 0;
        if (custExitPrice > 0) {
            finalExitPrice = custExitPrice;
        } else {
            // Apply Manual Jobbing Point (₹ flat amount)
            const refLtp = Number(orderData.jobbing_applied_ltp || 0) || finalExitPrice;
            finalExitPrice = refLtp;
            const jpValue = Number(orderData.jobbing_point) || 0;
            if (jpValue > 0 && finalExitPrice > 0) {
                finalExitPrice = orderData.side === 'BUY' ? finalExitPrice - jpValue : finalExitPrice + jpValue;
            }
        }
        const closedLtp = finalExitPrice > 0 ? Number(finalExitPrice.toFixed(4)) : 0;

        await Order.findByIdAndUpdate(orderId, {
            $set: {
                order_status: "CLOSED",
                closed_ltp: closedLtp,
                closed_at: new Date(),
                margin_blocked: 0,
                exit_reason: reason
            }
        });

        // C. ⚡ Release Fund Atomically
        const { broker_id_str, customer_id_str, product, margin_blocked, price, quantity, side } = orderData;
        const marginToRelease = Number(margin_blocked || (price * quantity) || 0);

        let pnl = 0;
        if (closedLtp > 0) {
            pnl = side === 'BUY' ? (closedLtp - price) * quantity : (price - closedLtp) * quantity;
        }

        if (marginToRelease > 0) {
            const isIntraday = String(product).trim().toUpperCase() === 'MIS';
            const fund = await Fund.findOne({ broker_id_str, customer_id_str });
            if (fund) {
                if (isIntraday) {
                    fund.intraday.used_limit = Math.max(0, (fund.intraday.used_limit || 0) - marginToRelease);
                    fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
                } else {
                    fund.overnight.available_limit = (fund.overnight.available_limit || 0) + marginToRelease;
                    fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
                }

                // Rollback Option & MCX daily limits
                const symUpper = String(orderData.symbol || "").toUpperCase();
                const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
                const isMcx = String(orderData.segment || "").trim().toUpperCase().includes("MCX");
                const isMcxOption = isOption && isMcx;
                const isNormalOption = isOption && !isMcx;
                const productNorm = String(product).trim().toUpperCase();

                if (isMcxOption) {
                    rollbackMcxOptionUsage(fund, productNorm, marginToRelease);
                } else if (isNormalOption) {
                    rollbackOptionUsage(fund, productNorm, marginToRelease);
                }

                if (isMcx) {
                    rollbackMcxUsage(fund, productNorm, marginToRelease);
                }

                await fund.save();
                console.log(`[OrderManager] Fund released for exit: ${marginToRelease}`);
            }
        }

        console.log(`✅ [OrderManager] Order ${orderId} Closed Successfully.`);

    } catch (error) {
        console.error(`❌ [OrderManager] Execution Error for Order ${orderId}:`, error);
    }
};

export const onMarketTick = async ({ token, ltp }) => {
    // 1. Check if we are watching this token
    if (!activeTriggers.has(String(token))) return;

    const ordersMap = activeTriggers.get(String(token));
    const currentLtp = Number(ltp);

    if (!currentLtp || currentLtp <= 0) return;

    const exitPromises = [];

    // 2. Iterate through orders Map
    for (const order of ordersMap.values()) {
        if (order.status === 'CLOSED' || order.status === 'RESTRICTED') {
            ordersMap.delete(order.orderId);
            continue;
        }

        let hit = false;
        let hitReason = "";
        let hitPrice = 0;

        if (order.side === 'BUY') {
            if (order.sl > 0 && currentLtp <= order.sl) {
                hit = true; hitReason = "STOPLOSS_HIT"; hitPrice = order.sl;
            } else if (order.target > 0 && currentLtp >= order.target) {
                hit = true; hitReason = "TARGET_HIT"; hitPrice = order.target;
            }
        } else {
            if (order.sl > 0 && currentLtp >= order.sl) {
                hit = true; hitReason = "STOPLOSS_HIT"; hitPrice = order.sl;
            } else if (order.target > 0 && currentLtp <= order.target) {
                hit = true; hitReason = "TARGET_HIT"; hitPrice = order.target;
            }
        }

        // 3. Queue Execution
        if (hit) {
            exitPromises.push(executeExit({ ...order, token: String(token) }, hitPrice, hitReason));
        }
    }

    if (ordersMap.size === 0) {
        activeTriggers.delete(String(token));
    }

    if (exitPromises.length > 0) {
        await Promise.allSettled(exitPromises);
    }
};