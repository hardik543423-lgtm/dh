import express from 'express';
import { createTransaction, getTransactions, updateTransactionStatus, getAllBrokerTransactions } from '../Controllers/transactionController.js';
import { protect, restrictToOwnerOrBroker } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictToOwnerOrBroker);

router.post('/create', createTransaction);
router.get('/history', getTransactions);
router.get('/all', getAllBrokerTransactions);
router.put('/updateStatus', updateTransactionStatus);

export default router;
