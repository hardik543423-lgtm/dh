import express from 'express';
import { getPermissions, updatePermissions } from '../Controllers/permissionController.js';
import { protect } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.get('/get', protect, getPermissions);
router.post('/update', protect, updatePermissions);

export default router;
