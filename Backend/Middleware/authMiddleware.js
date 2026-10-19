import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import BrokerModel from '../Model/BrokerModel.js';
import CustomerModel from '../Model/CustomerModel.js';
import { isBlacklisted } from '../Controllers/AuthController.js';

// protect middleware: verifies bearer token, checks blacklist, loads user
const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  if (typeof isBlacklisted === 'function') {
    if (isBlacklisted(token)) return res.status(401).json({ message: 'Session expired. Please login again.' });
  }

  if (token === 'super-broker-local-token') {
    // Grant Super Admin Access for the local Super Broker
    req.user = {
      _id: '000000000000009999912345', // Valid 24-char hex ObjectId
      name: 'Super Broker',
      role: 'admin',
      login_id: '9999912345', // Keep the original 10-digit ID as login_id
      organization_name: 'Super Broker'
    };
    req.role = 'admin';
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded expected shape: { id, role }
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' });

    if (decoded.role === 'broker') {
      req.user = await BrokerModel.findById(decoded.id).select('-password');
    } else if (decoded.role === 'customer') {
      req.user = await CustomerModel.findById(decoded.id).select('-password');
    } else {
      // fallback: try to find either
      req.user = await BrokerModel.findById(decoded.id).select('-password') || await CustomerModel.findById(decoded.id).select('-password');
    }

    if (!req.user) return res.status(401).json({ message: 'User not found in database' });
    if (req.user.is_banned) return res.status(403).json({ message: 'Your account has been banned. Please contact administrator.' });

    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
});

// adminOnly middleware: checks if user has admin role
// must be used AFTER protect middleware
const adminOnly = (req, res, next) => {
  if (req.role !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
  }
  next();
};

// restrictToOwnerOrBroker middleware: validates relationship between logged-in user and target broker/customer
const restrictToOwnerOrBroker = asyncHandler(async (req, res, next) => {
  // If admin/super-broker, allow bypass
  if (req.role === 'admin' || req.user?.role === 'admin') {
    return next();
  }

  // Get customer_id_str from body, query, or params
  const customer_id_str = req.query.customer_id_str || req.body.customer_id_str || req.params.customer_id_str || req.query.customerId || req.body.customerId || req.params.customerId;
  const broker_id_str = req.query.broker_id_str || req.body.broker_id_str || req.params.broker_id_str || req.query.brokerId || req.body.brokerId || req.params.brokerId;

  if (req.role === 'customer') {
    // 1. Force overwrite customer_id_str and broker_id_str to the logged-in customer's actual IDs to prevent tampering
    const customerId = req.user.customer_id;
    
    // Resolve the attached broker's login_id
    const broker = await BrokerModel.findById(req.user.attached_broker_id).select('login_id');
    const brokerId = broker?.login_id || '';

    // Overwrite query
    if (req.query) {
      if (req.query.customer_id_str !== undefined || customer_id_str) req.query.customer_id_str = customerId;
      if (req.query.customerId !== undefined) req.query.customerId = customerId;
      if (req.query.broker_id_str !== undefined || broker_id_str) req.query.broker_id_str = brokerId;
      if (req.query.brokerId !== undefined) req.query.brokerId = brokerId;
    }
    // Overwrite body
    if (req.body) {
      if (req.body.customer_id_str !== undefined || customer_id_str) req.body.customer_id_str = customerId;
      if (req.body.customerId !== undefined) req.body.customerId = customerId;
      if (req.body.broker_id_str !== undefined || broker_id_str) req.body.broker_id_str = brokerId;
      if (req.body.brokerId !== undefined) req.body.brokerId = brokerId;
    }
    // Overwrite params
    if (req.params) {
      if (req.params.customer_id_str !== undefined) req.params.customer_id_str = customerId;
      if (req.params.customerId !== undefined) req.params.customerId = customerId;
      if (req.params.broker_id_str !== undefined) req.params.broker_id_str = brokerId;
      if (req.params.brokerId !== undefined) req.params.brokerId = brokerId;
    }

    return next();
  }

  if (req.role === 'broker') {
    // 2. Broker must only query/modify their own customers or themselves
    const loggedInBrokerLoginId = req.user.login_id;
    const loggedInBrokerObjectId = req.user._id;

    // Overwrite broker_id_str to broker's own login_id to prevent claiming to act as another broker
    if (req.query && (req.query.broker_id_str !== undefined || broker_id_str)) req.query.broker_id_str = loggedInBrokerLoginId;
    if (req.query && req.query.brokerId !== undefined) req.query.brokerId = loggedInBrokerLoginId;
    if (req.body && (req.body.broker_id_str !== undefined || broker_id_str)) req.body.broker_id_str = loggedInBrokerLoginId;
    if (req.body && req.body.brokerId !== undefined) req.body.brokerId = loggedInBrokerLoginId;

    if (customer_id_str) {
      // Verify customer is attached to this broker
      const customer = await CustomerModel.findOne({ customer_id: customer_id_str });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      if (String(customer.attached_broker_id) !== String(loggedInBrokerObjectId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: This customer is not attached to your broker account.' });
      }
    }
    return next();
  }

  // Fallback for unauthorized roles
  return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
});

export { protect, adminOnly, restrictToOwnerOrBroker };