import mongoose from 'mongoose';

const fundSchema = new mongoose.Schema({
    customer_id_str: {
        type: String,
        required: true,
        index: true
    },
    broker_id_str: {
        type: String,
        required: true,
        index: true
    },

    net_available_balance: {
        type: Number,
        required: true,
        default: 0.00
    },

    net_pnl: {
        type: Number,
        default: 0.00
    },


    intraday: {

        available_limit: { 
            type: Number, 
            default: 0.00 
        },

        used_limit: { 
            type: Number, 
            default: 0.00 
        },

        free_limit: {
            type : Number,
            default: 0.00
        }

    },

    // 3. Overnight/Delivery Fund Section (Grey Tab)
    overnight: {
        available_limit: { 
            type: Number, 
            default: 0.00 
        },
        used_limit: { 
            type: Number, 
            default: 0.00 
        },
        free_limit: {
            type : Number,
            default: 0.00
        }
    },

    // 4. Option Limit Tracking (Daily 10% Cap) - SEGREGATED
    option_limit: {
        available_limit: { type: Number },
        used_limit: { type: Number },
        free_limit: { type: Number },
        intraday: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        },
        overnight: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        }
    },

    // Dynamic Option Limit Percentage (Default 10%)
    option_limit_percentage: {
        type: Number,
        default: 10
    },

    // 5. MCX Limit Tracking (Daily Cap) - SEGREGATED
    mcx_limit: {
        available_limit: { type: Number },
        used_limit: { type: Number },
        free_limit: { type: Number },
        intraday: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        },
        overnight: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        }
    },

    // Dynamic MCX Limit Percentage (Default 10%)
    mcx_limit_percentage: {
        type: Number,
        default: 10
    },

    broker_mobile_number:{type: Number},

    // Per-customer jobbing settings (set by broker for this specific customer)
    jobbing_settings: {
        price: { type: Number, default: 0.08 },
        type: { type: String, enum: ['percentage', 'points'], default: 'percentage' }
    },

    // Withdrawal limits (set by broker per customer)
    withdrawal_limits: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }  // 0 means no limit
    },

    // Payment details for adding funds
    payment_details: {
        broker_number: { type: String },
        bank_name: { type: String },
        ifsc: { type: String },
        holder_name: { type: String },
        account_number: { type: String },
        qr_code: { type: String } // Base64 or Image URL
    },

    // Standalone MCX deposit value
    mcx_deposit: {
        type: Number,
        default: 0.00
    },

    // MCX Option Limit Tracking (Segregated from regular options)
    mcx_option_limit: {
        available_limit: { type: Number, default: 0.00 },
        used_limit: { type: Number, default: 0.00 },
        free_limit: { type: Number, default: 0.00 },
        intraday: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        },
        overnight: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        }
    },
    mcx_option_limit_percentage: {
        type: Number,
        default: 10
    }

}, {
    timestamps: true, 
});

// Compound index for fast lookups (every fund query uses both fields)
fundSchema.index({ broker_id_str: 1, customer_id_str: 1 }, { unique: true });

const Fund = mongoose.model('FundModel', fundSchema);

export default Fund;
