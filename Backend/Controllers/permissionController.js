import Permission from '../Model/PermissionModel.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get permissions for a specific customer
 * @route   GET /api/permissions/get?broker_id_str=...&customer_id_str=...
 */
export const getPermissions = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str } = req.query;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Missing required IDs" });
    }

    let permissions = await Permission.findOne({ broker_id_str, customer_id_str });

    // If no record, return defaults
    if (!permissions) {
        return res.status(200).json({
            success: true,
            data: {
                locked_features: {
                    buy: false,
                    sell: false,
                    add_funds: false,
                    withdraw_funds: false,
                    modify_order: false,
                    cancel_order: false,
                    hide_order_dates: false
                }
            }
        });
    }

    res.status(200).json({ success: true, data: permissions });
});

/**
 * @desc    Update permissions for a customer
 * @route   POST /api/permissions/update
 */
export const updatePermissions = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, locked_features } = req.body;

    if (!broker_id_str || !customer_id_str) {
        return res.status(400).json({ success: false, message: "Missing required IDs" });
    }

    const permissions = await Permission.findOneAndUpdate(
        { broker_id_str, customer_id_str },
        { $set: { locked_features } },
        { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: permissions, message: "Permissions updated successfully" });
});
