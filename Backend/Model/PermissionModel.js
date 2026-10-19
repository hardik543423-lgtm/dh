import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
    broker_id_str: {
        type: String,
        required: true,
        index: true
    },
    customer_id_str: {
        type: String,
        required: true,
        index: true
    },
    locked_features: {
        buy: { type: Boolean, default: false },
        sell: { type: Boolean, default: false },
        add_funds: { type: Boolean, default: false },
        withdraw_funds: { type: Boolean, default: false },
        modify_order: { type: Boolean, default: false },
        cancel_order: { type: Boolean, default: false },
        hide_order_dates: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

// Compound index for quick lookups
permissionSchema.index({ broker_id_str: 1, customer_id_str: 1 }, { unique: true });

const Permission = mongoose.model('Permission', permissionSchema);

export default Permission;
