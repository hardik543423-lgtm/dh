import express from 'express';
import { getAdvancedJobbing, saveAdvancedJobbing } from '../Controllers/advancedJobbingController.js';
import { protect, restrictToOwnerOrBroker } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictToOwnerOrBroker);

router.get('/advanced-jobbing', getAdvancedJobbing);
router.post('/advanced-jobbing/save', saveAdvancedJobbing);

export default router;
