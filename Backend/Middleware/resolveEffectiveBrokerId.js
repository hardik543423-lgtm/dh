import Customer from '../Model/CustomerModel.js';
import Broker from '../Model/BrokerModel.js';

export const resolveEffectiveBrokerIdMiddleware = async (req, res, next) => {
    // Look for customer_id_str in query or body
    const customer_id_str = req.query.customer_id_str || req.body.customer_id_str;
    
    if (customer_id_str) {
        try {
            // Find the customer by their 10-digit ID
            const customer = await Customer.findOne({ customer_id: customer_id_str });
            if (customer && customer.attached_broker_id) {
                // Find the attached broker by ObjectId
                const broker = await Broker.findById(customer.attached_broker_id).select('login_id');
                if (broker && broker.login_id) {
                    const effectiveBrokerId = broker.login_id;
                    
                    // Override broker_id_str to ensure it matches the customer's actual broker
                    if (req.query && req.query.broker_id_str) {
                        req.query.broker_id_str = effectiveBrokerId;
                    }
                    if (req.body && req.body.broker_id_str) {
                        req.body.broker_id_str = effectiveBrokerId;
                    }
                }
            }
        } catch (e) {
            console.error("[resolveEffectiveBrokerIdMiddleware] Error resolving broker ID:", e);
        }
    }
    next();
};

export default resolveEffectiveBrokerIdMiddleware;
