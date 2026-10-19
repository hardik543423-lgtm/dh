import { getOrderInstrument, postOrder, updateOrder, exitAllOpenOrder, deleteOrder, deleteAllClosedOrders, updateClosedOrderPrices, postClosedOrder } from '../Controllers/orderController.js';
import express from "express";
import { validateRequest } from '../Middleware/validateRequest.js';
import { orderPlacementSchema, orderUpdateSchema } from '../Utils/schemas.js';
import { resolveEffectiveBrokerIdMiddleware } from '../Middleware/resolveEffectiveBrokerId.js';
import { protect, restrictToOwnerOrBroker } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.use(resolveEffectiveBrokerIdMiddleware);
router.use(protect);
router.use(restrictToOwnerOrBroker);


router.post('/postOrder', validateRequest(orderPlacementSchema), postOrder);
router.post('/postClosedOrder', postClosedOrder);
router.get('/getOrderInstrument', getOrderInstrument);
router.post('/updateOrder', validateRequest(orderUpdateSchema), updateOrder);
router.put('/exitAllOpenOrder', exitAllOpenOrder);

// Delete Routes
router.post('/deleteOrder', deleteOrder);
router.post('/deleteAllClosedOrders', deleteAllClosedOrders);

// Update Closed Order Prices (Safe Manual Edit)
router.post('/updateClosedOrderPrices', updateClosedOrderPrices);

export default router;