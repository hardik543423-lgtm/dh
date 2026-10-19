/**
 * OptionLimitManager.js
 * Handles the logic for Daily Option Limit (Intraday vs Overnight)
 * 
 * IMPORTANT: The `fund` object passed to checkOptionLimit may be a .lean() plain object.
 * Day-reset changes on it are in-memory only. The caller (orderController) must
 * persist the reset via resetOptionUsageIfNewDay() before checking limits.
 */

import Fund from '../Model/FundModel.js';

/**
 * Resets option usage in the DB if a new trading day has started.
 * MUST be called before checkOptionLimit to ensure used_today is accurate.
 * Works atomically on the DB so .lean() staleness doesn't matter.
 */
export const resetOptionUsageIfNewDay = async (broker_id_str, customer_id_str) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check and reset intraday option usage
    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) return null;

    let modified = false;

    // Ensure option_limit structure exists
    if (!fund.option_limit) fund.option_limit = {};

    for (const typeKey of ['intraday', 'overnight']) {
        if (!fund.option_limit[typeKey]) {
            fund.option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
            modified = true;
            continue;
        }

        const tracker = fund.option_limit[typeKey];
        let lastDate = tracker.last_trade_date ? new Date(tracker.last_trade_date) : null;
        if (lastDate) lastDate.setHours(0, 0, 0, 0);

        if (!lastDate || lastDate.getTime() !== today.getTime()) {
            // New day detected - reset usage
            tracker.used_today = 0;
            tracker.last_trade_date = new Date();
            modified = true;
        }
    }

    if (modified) {
        fund.markModified('option_limit');
        await fund.save();
    }

    return fund;
};

export const checkOptionLimit = (fund, product, requiredMargin) => {
    // 1. Determine Product Type (Intraday vs Overnight)
    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    // 2. Initialize if missing (in-memory for the check)
    if (!fund.option_limit) fund.option_limit = {};
    if (!fund.option_limit[typeKey]) {
        fund.option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.option_limit[typeKey];

    // 3. Date Check (Reset if new day) - in-memory for accurate check
    // NOTE: DB reset should have already been done by resetOptionUsageIfNewDay()
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = limitTracker.last_trade_date ? new Date(limitTracker.last_trade_date) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    if (!lastDate || lastDate.getTime() !== today.getTime()) {
        // New day - reset in-memory (DB was already reset by resetOptionUsageIfNewDay)
        limitTracker.used_today = 0;
        limitTracker.last_trade_date = new Date();
    }

    // 4. Calculate Maximum Allowed Cap
    // Priority: Use broker-set option_limit.available_limit if it exists and is > 0
    // Fallback: Dynamic % of relevant available limit
    let dailyCap = 0;
    const brokerSetLimit = fund.option_limit?.available_limit;

    if (brokerSetLimit !== undefined && brokerSetLimit !== null && brokerSetLimit > 0) {
        // Broker has explicitly set the option limit via Fund UI
        dailyCap = Number(brokerSetLimit);
    } else {
        // Dynamic calculation: % of relevant available limit
        let baseLimit = 0;
        if (isOvernight) {
            baseLimit = fund.overnight ? fund.overnight.available_limit : 0;
        } else {
            baseLimit = fund.intraday ? fund.intraday.available_limit : 0;
        }

        const limitPercent = fund.option_limit_percentage !== undefined ? Number(fund.option_limit_percentage) : 10;
        dailyCap = (baseLimit || 0) * (limitPercent / 100);
    }

    const currentUsed = limitTracker.used_today || 0;

    // 5. Check Constraint
    if ((currentUsed + requiredMargin) > dailyCap) {
        const limitPercent = fund.option_limit_percentage !== undefined ? Number(fund.option_limit_percentage) : 10;
        return {
            allowed: false,
            message: `Daily ${isOvernight ? 'Overnight' : 'Intraday'} Option Limit Exceeded (${limitPercent}% Cap). Max: ${dailyCap.toFixed(2)}, Used Today: ${currentUsed.toFixed(2)}, Required: ${requiredMargin.toFixed(2)}`
        };
    }

    return { allowed: true };
};

export const updateOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (!fund.option_limit) fund.option_limit = {};
    if (!fund.option_limit[typeKey]) {
        fund.option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.option_limit[typeKey];
    
    // Add to usage
    limitTracker.used_today = (limitTracker.used_today || 0) + Number(amount);
    limitTracker.last_trade_date = new Date();

    // Also update the display fields for UI consistency
    const totalUsed = (fund.option_limit.intraday?.used_today || 0) + (fund.option_limit.overnight?.used_today || 0);
    if (fund.option_limit.available_limit !== undefined) {
        fund.option_limit.used_limit = totalUsed;
        fund.option_limit.free_limit = Math.max(0, (fund.option_limit.available_limit || 0) - totalUsed);
    }
    
    // Force Mongoose to recognize the change
    if(fund.markModified) {
        fund.markModified('option_limit');
    }
};

export const rollbackOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (fund.option_limit && fund.option_limit[typeKey]) {
        const limitTracker = fund.option_limit[typeKey];
        limitTracker.used_today = (limitTracker.used_today || 0) - Number(amount);
        if (limitTracker.used_today < 0) limitTracker.used_today = 0;

        // Also update display fields
        const totalUsed = (fund.option_limit.intraday?.used_today || 0) + (fund.option_limit.overnight?.used_today || 0);
        if (fund.option_limit.available_limit !== undefined) {
            fund.option_limit.used_limit = totalUsed;
            fund.option_limit.free_limit = Math.max(0, (fund.option_limit.available_limit || 0) - totalUsed);
        }
        
        if(fund.markModified) {
            fund.markModified('option_limit');
        }
    }
};

