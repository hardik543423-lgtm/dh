import Transaction from '../Model/TransactionModel.js';
import Fund from '../Model/FundModel.js';
import asyncHandler from 'express-async-handler';

// Create a new transaction (Deposit or Withdraw)
const createTransaction = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, type, amount, payment_method, bank_details, reason, proof_image } = req.body;

    if (!amount || amount <= 0) {
        res.status(400);
        throw new Error("Invalid amount");
    }

    // Validate withdrawal limits if type is 'withdraw'
    if (type === 'withdraw') {
        const fund = await Fund.findOne({ broker_id_str, customer_id_str });
        if (fund?.withdrawal_limits) {
            const minLimit = fund.withdrawal_limits.min || 0;
            const maxLimit = fund.withdrawal_limits.max || 0;

            if (minLimit > 0 && amount < minLimit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Minimum withdrawal amount is ₹${minLimit}` 
                });
            }

            if (maxLimit > 0 && amount > maxLimit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Maximum withdrawal amount is ₹${maxLimit}` 
                });
            }
        }
    }

    const transaction = await Transaction.create({
        broker_id_str,
        customer_id_str,
        type,
        amount,
        payment_method,
        bank_details,
        reason,
        proof_image
    });

    res.status(201).json({ success: true, data: transaction });
});

// Get transaction history for a customer
const getTransactions = asyncHandler(async (req, res) => {
    const { broker_id_str, customer_id_str, status } = req.query;

    const filter = { broker_id_str, customer_id_str };
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: transactions });
});

// Get ALL transactions for a broker (for all their customers)
const getAllBrokerTransactions = asyncHandler(async (req, res) => {
    const { broker_id_str, status } = req.query;

    const filter = { broker_id_str };
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: transactions });
});

// Update transaction status (Broker only)
const updateTransactionStatus = asyncHandler(async (req, res) => {
    const { transaction_id, status } = req.body;

    const transaction = await Transaction.findById(transaction_id);
    if (!transaction) {
        res.status(404);
        throw new Error("Transaction not found");
    }

    const oldStatus = transaction.status;
    transaction.status = status;
    await transaction.save();

    // If verified, update the fund balance
    if (status === 'verified' && oldStatus !== 'verified') {
        const adjustment = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
        
        await Fund.findOneAndUpdate(
            { broker_id_str: transaction.broker_id_str, customer_id_str: transaction.customer_id_str },
            { 
                $inc: { 
                    net_available_balance: adjustment,
                    "intraday.available_limit": adjustment,
                    "intraday.free_limit": adjustment,
                    "overnight.available_limit": adjustment,
                    "overnight.free_limit": adjustment
                } 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    res.status(200).json({ success: true, data: transaction });
});

export { createTransaction, getTransactions, updateTransactionStatus, getAllBrokerTransactions };
