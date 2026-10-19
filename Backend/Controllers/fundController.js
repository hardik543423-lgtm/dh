// Example Controller Function
import Fund from '../Model/FundModel.js'; // Ensure casing matches exactly
import asyncHandler from 'express-async-handler';

/**
 * Helper: Reset option usage for a fund if it's a new trading day.
 * This keeps UI display (used_today) in sync when fetching funds.
 */
const resetOptionUsageForFunds = async (fund) => {
    if (!fund || !fund.option_limit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let modified = false;

    for (const typeKey of ['intraday', 'overnight']) {
        const tracker = fund.option_limit?.[typeKey];
        if (!tracker) continue;

        let lastDate = tracker.last_trade_date ? new Date(tracker.last_trade_date) : null;
        if (lastDate) lastDate.setHours(0, 0, 0, 0);

        if (!lastDate || lastDate.getTime() !== today.getTime()) {
            tracker.used_today = 0;
            tracker.last_trade_date = new Date();
            modified = true;
        }
    }

    if (modified) {
        // Also sync display fields
        const totalUsed = (fund.option_limit.intraday?.used_today || 0) + (fund.option_limit.overnight?.used_today || 0);
        if (fund.option_limit.available_limit !== undefined) {
            fund.option_limit.used_limit = totalUsed;
            fund.option_limit.free_limit = Math.max(0, (fund.option_limit.available_limit || 0) - totalUsed);
        }
        fund.markModified('option_limit');
        await fund.save();
    }
};

const resetMcxUsageForFunds = async (fund) => {
    if (!fund || !fund.mcx_limit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let modified = false;

    for (const typeKey of ['intraday', 'overnight']) {
        const tracker = fund.mcx_limit?.[typeKey];
        if (!tracker) continue;

        let lastDate = tracker.last_trade_date ? new Date(tracker.last_trade_date) : null;
        if (lastDate) lastDate.setHours(0, 0, 0, 0);

        if (!lastDate || lastDate.getTime() !== today.getTime()) {
            tracker.used_today = 0;
            tracker.last_trade_date = new Date();
            modified = true;
        }
    }

    if (modified) {
        const totalUsed = (fund.mcx_limit.intraday?.used_today || 0) + (fund.mcx_limit.overnight?.used_today || 0);
        if (fund.mcx_limit.available_limit !== undefined) {
            fund.mcx_limit.used_limit = totalUsed;
            fund.mcx_limit.free_limit = Math.max(0, (fund.mcx_limit.available_limit || 0) - totalUsed);
        }
        fund.markModified('mcx_limit');
        await fund.save();
    }
};

const resetMcxOptionUsageForFunds = async (fund) => {
    if (!fund || !fund.mcx_option_limit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let modified = false;

    for (const typeKey of ['intraday', 'overnight']) {
        const tracker = fund.mcx_option_limit?.[typeKey];
        if (!tracker) continue;

        let lastDate = tracker.last_trade_date ? new Date(tracker.last_trade_date) : null;
        if (lastDate) lastDate.setHours(0, 0, 0, 0);

        if (!lastDate || lastDate.getTime() !== today.getTime()) {
            tracker.used_today = 0;
            tracker.last_trade_date = new Date();
            modified = true;
        }
    }

    if (modified) {
        const totalUsed = (fund.mcx_option_limit.intraday?.used_today || 0) + (fund.mcx_option_limit.overnight?.used_today || 0);
        if (fund.mcx_option_limit.available_limit !== undefined) {
            fund.mcx_option_limit.used_limit = totalUsed;
            fund.mcx_option_limit.free_limit = Math.max(0, (fund.mcx_option_limit.available_limit || 0) - totalUsed);
        }
        fund.markModified('mcx_option_limit');
        await fund.save();
    }
};

const updateNetAvailableBalance = async (req, res) => {
    const { broker_id_str, customer_id_str, new_balance } = req.body;

    try {
        const updatedFund = await Fund.findOneAndUpdate(
            { broker_id_str, customer_id_str },
            { 
                $set: { 
                    net_available_balance: new_balance,
                } 
            },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, data: updatedFund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateNetPnl = async (req, res) => {
    const { broker_id_str, customer_id_str, new_pnl } = req.body;

    try {
        const updatedFund = await Fund.findOneAndUpdate(
            { broker_id_str, customer_id_str },
            { 
                $set: { 
                    net_pnl: new_pnl,
                } 
            },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, data: updatedFund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updatePaymentDetails = async (req, res) => {
    const { broker_id_str, customer_id_str, payment_details } = req.body;

    try {
        const updatedFund = await Fund.findOneAndUpdate(
            { broker_id_str, customer_id_str },
            { 
                $set: { 
                    payment_details: payment_details,
                } 
            },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, data: updatedFund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getFunds = asyncHandler(async (req, res) => {

    const { broker_id_str, customer_id_str } = req.query;

    // 2. Validation
    if (!broker_id_str || !customer_id_str) {
        res.status(400);
        throw new Error("Missing Broker ID or Customer ID");
    }

    // 3. Database mein Fund find karein
    let fund = await Fund.findOne({ 
        broker_id_str, 
        customer_id_str 
    });

    // 4. Agar Fund record nahi mila (New User), to Default create karein
    if (!fund) {
        fund = await Fund.create({
            broker_id_str,
            customer_id_str,
            net_available_balance: 0,
            intraday: {
                available_limit: 0,
                used_limit: 0
            },
            overnight: {
                available_limit: 0,
                used_limit: 0
            }
        });
        console.log(`New Fund record created for Customer: ${customer_id_str}`);
    } else {
        // Reset option and MCX usage if it's a new trading day (keeps UI in sync)
        await resetOptionUsageForFunds(fund);
        await resetMcxUsageForFunds(fund);
        await resetMcxOptionUsageForFunds(fund);
    }

    // 5. Response bhejein
    res.status(200).json({
        success: true,
        data: fund
    });
});
const syncDependentLimits = (fund) => {
    const totalBaseMargin = (fund.intraday?.available_limit || 0) + (fund.overnight?.available_limit || 0);

    // 1. Regular Option Limit
    const optionPct = fund.option_limit_percentage !== undefined ? fund.option_limit_percentage : 10;
    const optionAvail = totalBaseMargin * (optionPct / 100);
    if (!fund.option_limit) fund.option_limit = {};
    fund.option_limit.available_limit = optionAvail;
    fund.option_limit.free_limit = Math.max(0, optionAvail - (fund.option_limit.used_limit || 0));

    // 2. MCX Limit
    const mcxPct = fund.mcx_limit_percentage !== undefined ? fund.mcx_limit_percentage : 10;
    const mcxAvail = totalBaseMargin * (mcxPct / 100);
    if (!fund.mcx_limit) fund.mcx_limit = {};
    fund.mcx_limit.available_limit = mcxAvail;
    fund.mcx_limit.free_limit = Math.max(0, mcxAvail - (fund.mcx_limit.used_limit || 0));

    // 3. MCX Option Limit
    const mcxOptionPct = fund.mcx_option_limit_percentage !== undefined ? fund.mcx_option_limit_percentage : 10;
    const mcxOptionAvail = totalBaseMargin * (mcxOptionPct / 100);
    if (!fund.mcx_option_limit) fund.mcx_option_limit = {};
    fund.mcx_option_limit.available_limit = mcxOptionAvail;
    fund.mcx_option_limit.free_limit = Math.max(0, mcxOptionAvail - (fund.mcx_option_limit.used_limit || 0));
};

const updateIntradayLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;

    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.intraday.available_limit = Number(new_limit);
    fund.intraday.free_limit = Number(new_limit) - (fund.intraday.used_limit || 0);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateIntradayAvailabeLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;
    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.intraday.available_limit = Number(new_limit);
    fund.intraday.free_limit = Number(new_limit) - (fund.intraday.used_limit || 0);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateOvernightAvailableLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;

    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.overnight.available_limit = Number(new_limit);
    fund.overnight.free_limit = Number(new_limit) - (fund.overnight.used_limit || 0);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateIntradayLimitsAll = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, available_limit, free_limit, used_limit } = req.body;

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.intraday.available_limit = available_limit !== undefined ? Number(available_limit) : 0;
    fund.intraday.free_limit = free_limit !== undefined ? Number(free_limit) : 0;
    fund.intraday.used_limit = used_limit !== undefined ? Number(used_limit) : 0;

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateOvernightLimitsAll = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, available_limit, free_limit, used_limit } = req.body;

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.overnight.available_limit = available_limit !== undefined ? Number(available_limit) : 0;
    fund.overnight.free_limit = free_limit !== undefined ? Number(free_limit) : 0;
    fund.overnight.used_limit = used_limit !== undefined ? Number(used_limit) : 0;

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateOptionLimitsAll = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, available_limit, free_limit, used_limit } = req.body;

    const effectiveUsed = used_limit !== undefined ? Number(used_limit) : 0;

    // Update BOTH display fields AND the actual tracking fields (used_today)
    // so checkOptionLimit reads the same values the UI shows
    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "option_limit.available_limit": available_limit !== undefined ? available_limit : 0,
                "option_limit.free_limit": free_limit !== undefined ? free_limit : 0,
                "option_limit.used_limit": effectiveUsed,
                // Sync tracking fields with display — broker's edit is the source of truth
                "option_limit.intraday.used_today": effectiveUsed,
                "option_limit.intraday.last_trade_date": new Date(),
                "option_limit.overnight.used_today": 0,
                "option_limit.overnight.last_trade_date": new Date()
            } 
        },
        { new: true }
    );

    res.status(200).json({ success: true, data: updatedFund });
});



const updateMcxLimitsAll = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, available_limit, free_limit, used_limit } = req.body;

    const effectiveUsed = used_limit !== undefined ? Number(used_limit) : 0;

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "mcx_limit.available_limit": available_limit !== undefined ? available_limit : 0,
                "mcx_limit.free_limit": free_limit !== undefined ? free_limit : 0,
                "mcx_limit.used_limit": effectiveUsed,
                "mcx_limit.intraday.used_today": effectiveUsed,
                "mcx_limit.intraday.last_trade_date": new Date(),
                "mcx_limit.overnight.used_today": 0,
                "mcx_limit.overnight.last_trade_date": new Date()
            } 
        },
        { new: true }
    );

    res.status(200).json({ success: true, data: updatedFund });
});
const updateBrokerMobile = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, mobile } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }
    
    if (!mobile) {
        return res.status(400).json({ success: false, message: "Mobile number is required" });
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str }, // 1. Filter
        { 
            $set: { 
                broker_mobile_number: Number(mobile) 
            } 
        }, // 2. Update
        { new: true, upsert: true } // 3. Options
    );

    res.status(200).json({ 
        success: true, 
        message: "Mobile Number Updated Successfully", 
        data: updatedFund 
    });
});

const updateOptionLimitPercentage = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, percentage } = req.body;

    if (percentage === undefined || percentage === null) {
        return res.status(400).json({ success: false, message: "Percentage is required" });
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        return res.status(404).json({ success: false, message: "Fund record not found" });
    }

    fund.option_limit_percentage = Number(percentage);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateMcxLimitPercentage = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, percentage } = req.body;

    if (percentage === undefined || percentage === null) {
        return res.status(400).json({ success: false, message: "Percentage is required" });
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        return res.status(404).json({ success: false, message: "Fund record not found" });
    }

    fund.mcx_limit_percentage = Number(percentage);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

// =============================================
// 📦 PER-CUSTOMER JOBBING SETTINGS
// =============================================

/**
 * @desc    Get customer-specific jobbing settings from Fund document
 * @route   GET /api/funds/getCustomerJobbing?broker_id_str=...&customer_id_str=...
 */
const getCustomerJobbing = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str } = req.query;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }

    let fund = await Fund.findOne({ broker_id_str, customer_id_str });

    // If no fund record exists yet, return defaults
    if (!fund) {
        return res.status(200).json({
            success: true,
            jobbing: { price: 0.08, type: 'percentage' }
        });
    }

    // Return jobbing_settings (will use schema defaults if not set)
    res.status(200).json({
        success: true,
        jobbing: {
            price: fund.jobbing_settings?.price ?? 0.08,
            type: fund.jobbing_settings?.type ?? 'percentage'
        }
    });
});

/**
 * @desc    Update customer-specific jobbing settings in Fund document
 * @route   PUT /api/funds/updateCustomerJobbing
 * @body    { broker_id_str, customer_id_str, price, type }
 */
const updateCustomerJobbing = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, price, type } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }

    if (price === undefined || price === null) {
        return res.status(400).json({ success: false, message: "Jobbing price is required" });
    }

    if (type && !['percentage', 'points'].includes(type)) {
        return res.status(400).json({ success: false, message: "Jobbing type must be 'percentage' or 'points'" });
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        {
            $set: {
                'jobbing_settings.price': Number(price),
                'jobbing_settings.type': type || 'percentage'
            }
        },
        { new: true, upsert: true }
    );

    console.log(`[FundController] Jobbing updated for ${customer_id_str}: price=${price}, type=${type}`);

    // Emit live update to connected sockets
    try {
        const { getIO } = await import('../sockets/io.js');
        const io = getIO();
        io.of('/market').emit('customer_jobbing_updated', {
            customer_id: customer_id_str,
            jobbing: {
                price: Number(price),
                type: type || 'percentage'
            }
        });
        console.log(`[FundController] Emitted 'customer_jobbing_updated' for customer ${customer_id_str}`);
    } catch (err) {
        console.warn(`[FundController] Failed to emit jobbing update event:`, err.message);
    }

    res.status(200).json({
        success: true,
        message: "Jobbing settings updated successfully",
        jobbing: {
            price: updatedFund.jobbing_settings?.price,
            type: updatedFund.jobbing_settings?.type
        }
    });
});

// =============================================
// 📦 WITHDRAWAL LIMITS (Per-Customer)
// =============================================

/**
 * @desc    Update withdrawal limits for a specific customer
 * @route   PUT /api/funds/updateWithdrawalLimits
 * @body    { broker_id_str, customer_id_str, min, max }
 */
const updateWithdrawalLimits = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, min, max } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }

    if (min !== undefined && max !== undefined && Number(max) > 0 && Number(min) > Number(max)) {
        return res.status(400).json({ success: false, message: "Min limit cannot be greater than Max limit" });
    }

    const updateObj = {};
    if (min !== undefined) updateObj['withdrawal_limits.min'] = Number(min);
    if (max !== undefined) updateObj['withdrawal_limits.max'] = Number(max);

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { $set: updateObj },
        { new: true, upsert: true }
    );

    console.log(`[FundController] Withdrawal limits updated for ${customer_id_str}: min=${min}, max=${max}`);

    res.status(200).json({
        success: true,
        message: "Withdrawal limits updated successfully",
        withdrawal_limits: updatedFund.withdrawal_limits
    });
});

/**
 * @desc    Get withdrawal limits for a specific customer
 * @route   GET /api/funds/getWithdrawalLimits?broker_id_str=...&customer_id_str=...
 */
const getWithdrawalLimits = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str } = req.query;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID required" });
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });

    res.status(200).json({
        success: true,
        withdrawal_limits: {
            min: fund?.withdrawal_limits?.min ?? 0,
            max: fund?.withdrawal_limits?.max ?? 0
        }
    });
});

const updateMcxDeposit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_deposit } = req.body;

    if (new_deposit === undefined) {
        res.status(400);
        throw new Error("New deposit is required");
    }

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                mcx_deposit: Number(new_deposit)
            } 
        },
        { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: updatedFund });
});

const updateMcxAvailableLimit = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, new_limit } = req.body;

    if (new_limit === undefined) {
        res.status(400);
        throw new Error("New limit is required");
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    const used = fund?.mcx_limit?.used_limit || 0;

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "mcx_limit.available_limit": Number(new_limit),
                "mcx_limit.free_limit": Math.max(0, Number(new_limit) - used)
            } 
        },
        { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: updatedFund });
});

const updateMcxOptionLimitPercentage = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, percentage } = req.body;

    if (percentage === undefined || percentage === null) {
        res.status(400);
        throw new Error("Percentage is required");
    }

    const fund = await Fund.findOne({ broker_id_str, customer_id_str });
    if (!fund) {
        res.status(404);
        throw new Error("Fund record not found");
    }

    fund.mcx_option_limit_percentage = Number(percentage);

    syncDependentLimits(fund);
    await fund.save();

    res.status(200).json({ success: true, data: fund });
});

const updateMcxOptionLimitsAll = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, available_limit, free_limit, used_limit } = req.body;

    const effectiveUsed = used_limit !== undefined ? Number(used_limit) : 0;

    const updatedFund = await Fund.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { 
            $set: { 
                "mcx_option_limit.available_limit": available_limit !== undefined ? Number(available_limit) : 0,
                "mcx_option_limit.free_limit": free_limit !== undefined ? Number(free_limit) : 0,
                "mcx_option_limit.used_limit": effectiveUsed,
                "mcx_option_limit.intraday.used_today": effectiveUsed,
                "mcx_option_limit.intraday.last_trade_date": new Date(),
                "mcx_option_limit.overnight.used_today": 0,
                "mcx_option_limit.overnight.last_trade_date": new Date()
            } 
        },
        { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: updatedFund });
});

export { getFunds, updateNetAvailableBalance, updateNetPnl, updateIntradayLimit, updateIntradayAvailabeLimit, updateOvernightAvailableLimit, updateIntradayLimitsAll, updateOvernightLimitsAll, updateOptionLimitsAll, updateMcxLimitsAll, updateBrokerMobile, updateOptionLimitPercentage, updateMcxLimitPercentage, getCustomerJobbing, updateCustomerJobbing, updatePaymentDetails, updateWithdrawalLimits, getWithdrawalLimits, updateMcxDeposit, updateMcxAvailableLimit, updateMcxOptionLimitPercentage, updateMcxOptionLimitsAll };
