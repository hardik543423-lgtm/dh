import express from 'express';
import { 
    deleteBroker, 
    getDeletedBrokers, 
    restoreBroker, 
    permanentDeleteBroker,
    toggleBanBroker,
    toggleCustomerCreation
} from '../Controllers/SuperBrocker.js';
import { protect, adminOnly } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

// Delete a broker (Move to Recycle Bin)
router.delete('/delete-broker/:id', deleteBroker);

// Get list of deleted brokers
router.get('/deleted-brokers', getDeletedBrokers);

// Restore a broker (and their customers)
router.post('/restore-broker/:id', restoreBroker);

// Permanently delete a broker
router.delete('/permanent-delete/:id', permanentDeleteBroker);

// Toggle ban status for a broker
router.post('/toggle-ban-broker/:id', toggleBanBroker);

// Toggle customer creation permission for a broker
router.post('/toggle-customer-creation/:id', toggleCustomerCreation);

export default router;
