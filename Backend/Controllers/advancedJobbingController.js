import AdvancedJobbing from '../Model/AdvancedJobbingModel.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get advanced jobbing ranges for a broker-customer pair
 * @route   GET /api/advanced-jobbing
 */
export const getAdvancedJobbing = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str } = req.query;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID are required" });
    }

    const doc = await AdvancedJobbing.findOne({ broker_id_str, customer_id_str });

    res.status(200).json({
        success: true,
        ranges: doc ? doc.ranges : []
    });
});

/**
 * @desc    Save/Update advanced jobbing ranges for a broker-customer pair
 * @route   POST /api/advanced-jobbing/save
 */
export const saveAdvancedJobbing = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, ranges } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Broker ID and Customer ID are required" });
    }

    if (!Array.isArray(ranges)) {
        return res.status(400).json({ success: false, message: "Ranges must be an array" });
    }

    // Basic validation on the ranges array
    for (const r of ranges) {
        if (r.start_range === undefined || r.end_range === undefined || r.jobbing_value === undefined) {
            return res.status(400).json({ success: false, message: "All range elements must have start_range, end_range and jobbing_value" });
        }
    }

    if (ranges.length === 0) {
        await AdvancedJobbing.deleteOne({ broker_id_str, customer_id_str });
        return res.status(200).json({
            success: true,
            message: "Advanced jobbing ranges deleted successfully",
            ranges: []
        });
    }

    const doc = await AdvancedJobbing.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { $set: { ranges } },
        { new: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: "Advanced jobbing ranges saved successfully",
        ranges: doc.ranges
    });
});
