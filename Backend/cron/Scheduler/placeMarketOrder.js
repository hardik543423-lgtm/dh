import mongoose from 'mongoose';
import { getKiteLTP } from '../../services/kiteQuote.js';
import Order from '../../Model/OrdersModel.js';
import Fund from '../../Model/FundModel.js';
import { rollbackOptionUsage } from '../../Utils/OptionLimitManager.js';
import { rollbackMcxUsage } from '../../Utils/McxLimitManager.js';
import { rollbackMcxOptionUsage } from '../../Utils/McxOptionLimitManager.js';
import { removeFromWatchlist } from '../../Utils/OrderManager.js';

// ---------------------------------------------------------
// 1. HELPER: Fetch Live LTP (Using Kite Quote API)
// ---------------------------------------------------------
async function getLiveLtp(instrumentToken) {
    try {
        if (!instrumentToken) return 0;

        // Use our centralized Kite service
        const data = await getKiteLTP([instrumentToken]);

        // Data format: { "256265": { last_price: ..., ... } }
        if (data && data[instrumentToken] && data[instrumentToken].last_price) {
            return data[instrumentToken].last_price;
        }

        return 0;

    } catch (err) {
        console.error('[getLiveLtp] API Error:', err.message);
        return 0;
    }
}

// ---------------------------------------------------------
// 2. HELPER: Release Funds & Calculate P&L
// ---------------------------------------------------------
const releaseFundsOnSquareoff = async (order, exitPrice) => {
    try {
        const fund = await Fund.findOne({
            broker_id_str: order.broker_id_str,
            customer_id_str: order.customer_id_str
        });

        if (!fund) return;

        // 1. Sirf Margin Calculate karo (Jo blocked tha)
        const qty = Number(order.quantity);
        const entryPrice = Number(order.price || order.average_price);
        const marginToRelease = Number(order.margin_blocked) || (entryPrice * qty);

        // (P&L aur Brokerage ka logic hata diya hai)

        const isIntraday = (order.product === 'MIS' || order.came_From === 'Hold' || order.order_status === 'HOLD');

        if (marginToRelease > 0) {
            if (isIntraday) {
                fund.intraday.used_limit = Math.max(0, (fund.intraday.used_limit || 0) - marginToRelease);
                fund.intraday.free_limit = Math.max(0, (fund.intraday.available_limit || 0) - fund.intraday.used_limit);
            } else {
                fund.overnight.available_limit = (fund.overnight.available_limit || 0) + marginToRelease;
                fund.overnight.free_limit = Math.max(0, (fund.overnight.available_limit || 0) - (fund.overnight.used_limit || 0));
            }

            // Rollback Option & MCX daily limits
            const symUpper = String(order.symbol || "").toUpperCase();
            const isOption = (symUpper.endsWith("CE") || symUpper.endsWith("PE") || symUpper.endsWith("CALL") || symUpper.endsWith("PUT"));
            const isMcx = String(order.segment || "").trim().toUpperCase().includes("MCX");
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

            await fund.save();
            console.log(`[Squareoff] Funds Released (Margin Only): ${marginToRelease}`);
        }
    } catch (e) {
        console.error('[Squareoff] Fund Release Error:', e);
    }
};

// ---------------------------------------------------------
// 3. MAIN FUNCTION: placeMarketOrder
// ---------------------------------------------------------
async function placeMarketOrder(orderId) {
    if (!orderId) {
        return { ok: false, error: 'orderId is required' };
    }

    try {
        // 1. Fetch Full Order Details
        let order = null;
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            order = await Order.findById(orderId).lean();
        }
        if (!order) {
            order = await Order.findOne({ order_id: orderId }).lean();
        }

        if (!order) {
            return { ok: false, error: 'Order not found' };
        }

        // 2. Fetch LIVE LTP from Kite API
        // Use instrument_token which implies standardization to Kite
        const tokenToFetch = order.instrument_token || order.security_Id; // Fallback if migration incomplete
        let currentLtp = await getLiveLtp(tokenToFetch);

        // Fallback: If API fails (returns 0), use the last known LTP from DB to prevent 0 price exit
        if (!currentLtp || currentLtp === 0) {
            currentLtp = Number(order.ltp) || Number(order.price);
            console.log(`[placeMarketOrder] API Price fetch failed. Using stored LTP: ${currentLtp}`);
        }

        // 3. Determine 'came_From'
        let prevStatus = order.order_status || order.orderStatus || '';
        if (order.order_category === 'OVERNIGHT') prevStatus = order.order_category;

        let cameFrom = 'Hold';
        if (prevStatus === 'OPEN') cameFrom = 'Open';
        else if (prevStatus === 'OVERNIGHT') cameFrom = 'Overnight';
        else if (prevStatus === 'HOLD') cameFrom = 'Hold';

        // 4. Update Order in DB
        const res = await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    order_status: 'CLOSED',
                    closed_at: new Date().toISOString(),
                    came_From: cameFrom,
                    closed_ltp: Number(Number(currentLtp).toFixed(2)) // ✅ Save Live Price
                }
            }
        );

        console.log('[placeMarketOrder] updateOne result', res);

        if (res.matchedCount > 0 || res.modifiedCount > 0) {
            console.log(`[placeMarketOrder] Order ${order._id} Closed at ₹${currentLtp}`);

            // Remove from memory watchlist so TP/SL triggers won't execute on closed order
            removeFromWatchlist(order._id, order.instrument_token || order.security_Id);

            // 5. Release Funds Logic
            await releaseFundsOnSquareoff(order, currentLtp);

            return {
                ok: true,
                action: 'status_updated_to_closed',
                orderId: String(order._id),
                price: currentLtp
            };
        }
        return { ok: false, error: 'Update failed', details: res };

    } catch (err) {
        console.error('[placeMarketOrder] DB error:', err);
        return { ok: false, error: 'DB error', details: err.message || String(err) };
    }
}

export { placeMarketOrder };
export default placeMarketOrder;
