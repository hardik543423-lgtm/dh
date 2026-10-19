/**
 * McxOptionLimitManager.js
 * Handles the logic for Daily MCX Option Limit
 */

import Fund from '../Model/FundModel.js';

/**
 * Resets MCX option usage in the DB if a new trading day has started.
 */
export const resetMcxOptionUsageIfNewDay = async (broker_id_str, customer_id_str) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) return null;

    let modified = false;

    if (!fund.mcx_option_limit) fund.mcx_option_limit = {};

    for (const typeKey of ['intraday', 'overnight']) {
        if (!fund.mcx_option_limit[typeKey]) {
            fund.mcx_option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
            modified = true;
            continue;
        }

        const tracker = fund.mcx_option_limit[typeKey];
        let lastDate = tracker.last_trade_date ? new Date(tracker.last_trade_date) : null;
        if (lastDate) lastDate.setHours(0, 0, 0, 0);

        if (!lastDate || lastDate.getTime() !== today.getTime()) {
            tracker.used_today = 0;
            tracker.last_trade_date = new Date();
            modified = true;
        }
    }

    if (modified) {
        fund.markModified('mcx_option_limit');
        await fund.save();
    }

    return fund;
};

export const checkMcxOptionLimit = (fund, product, requiredMargin) => {
    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (!fund.mcx_option_limit) fund.mcx_option_limit = {};
    if (!fund.mcx_option_limit[typeKey]) {
        fund.mcx_option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.mcx_option_limit[typeKey];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = limitTracker.last_trade_date ? new Date(limitTracker.last_trade_date) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    if (!lastDate || lastDate.getTime() !== today.getTime()) {
        limitTracker.used_today = 0;
        limitTracker.last_trade_date = new Date();
    }

    let dailyCap = 0;
    const brokerSetLimit = fund.mcx_option_limit?.available_limit;

    if (brokerSetLimit !== undefined && brokerSetLimit !== null && brokerSetLimit > 0) {
        dailyCap = Number(brokerSetLimit);
    } else {
        // Base limit is the MCX available limit
        const baseLimit = fund.mcx_limit ? fund.mcx_limit.available_limit : 0;
        const limitPercent = fund.mcx_option_limit_percentage !== undefined ? Number(fund.mcx_option_limit_percentage) : 10;
        dailyCap = (baseLimit || 0) * (limitPercent / 100);
    }

    const currentUsed = limitTracker.used_today || 0;

    if ((currentUsed + requiredMargin) > dailyCap) {
        const limitPercent = fund.mcx_option_limit_percentage !== undefined ? Number(fund.mcx_option_limit_percentage) : 10;
        return {
            allowed: false,
            message: `Daily ${isOvernight ? 'Overnight' : 'Intraday'} MCX Option Limit Exceeded (${limitPercent}% Cap). Max: ${dailyCap.toFixed(2)}, Used Today: ${currentUsed.toFixed(2)}, Required: ${requiredMargin.toFixed(2)}`
        };
    }

    return { allowed: true };
};

export const updateMcxOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (!fund.mcx_option_limit) fund.mcx_option_limit = {};
    if (!fund.mcx_option_limit[typeKey]) {
        fund.mcx_option_limit[typeKey] = { used_today: 0, last_trade_date: new Date() };
    }

    const limitTracker = fund.mcx_option_limit[typeKey];
    
    limitTracker.used_today = (limitTracker.used_today || 0) + Number(amount);
    limitTracker.last_trade_date = new Date();

    const totalUsed = (fund.mcx_option_limit.intraday?.used_today || 0) + (fund.mcx_option_limit.overnight?.used_today || 0);
    if (fund.mcx_option_limit.available_limit !== undefined) {
        fund.mcx_option_limit.used_limit = totalUsed;
        fund.mcx_option_limit.free_limit = Math.max(0, (fund.mcx_option_limit.available_limit || 0) - totalUsed);
    }
    
    if(fund.markModified) {
        fund.markModified('mcx_option_limit');
    }
};

export const rollbackMcxOptionUsage = (fund, product, amount) => {
    if (amount <= 0) return;

    const productNorm = String(product).trim().toUpperCase();
    const isOvernight = productNorm === 'NRML';
    const typeKey = isOvernight ? 'overnight' : 'intraday';

    if (fund.mcx_option_limit && fund.mcx_option_limit[typeKey]) {
        const limitTracker = fund.mcx_option_limit[typeKey];
        limitTracker.used_today = (limitTracker.used_today || 0) - Number(amount);
        if (limitTracker.used_today < 0) limitTracker.used_today = 0;

        const totalUsed = (fund.mcx_option_limit.intraday?.used_today || 0) + (fund.mcx_option_limit.overnight?.used_today || 0);
        if (fund.mcx_option_limit.available_limit !== undefined) {
            fund.mcx_option_limit.used_limit = totalUsed;
            fund.mcx_option_limit.free_limit = Math.max(0, (fund.mcx_option_limit.available_limit || 0) - totalUsed);
        }
        
        if(fund.markModified) {
            fund.markModified('mcx_option_limit');
        }
    }
};
