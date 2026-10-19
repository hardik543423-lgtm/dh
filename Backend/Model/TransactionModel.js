import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
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
    type: {
        type: String,
        enum: ['deposit', 'withdraw'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    payment_method: {
        type: String,
        default: 'bank'
    },
    bank_details: {
        bank_name: String,
        account_number: String,
        ifsc: String
    },
    reason: {
        type: String
    },
    proof_image: {
        type: String // Base64 or URL
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
