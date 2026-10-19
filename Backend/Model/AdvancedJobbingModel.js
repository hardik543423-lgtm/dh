import mongoose from 'mongoose';

const advancedJobbingSchema = new mongoose.Schema({
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
    ranges: [
        {
            start_range: { type: Number, required: true },
            end_range: { type: Number, required: true },
            jobbing_value: { type: Number, required: true },
            jobbing_type: { type: String, enum: ['percentage', 'points'], default: 'percentage' }
        }
    ]
}, {
    timestamps: true
});

// Compound index to ensure uniqueness per broker-customer
advancedJobbingSchema.index({ broker_id_str: 1, customer_id_str: 1 }, { unique: true });

const AdvancedJobbing = mongoose.model('AdvancedJobbing', advancedJobbingSchema);
export default AdvancedJobbing;
