import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Fund from './Model/FundModel.js';
import Order from './Model/OrdersModel.js';
import Broker from './Model/BrokerModel.js';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL;

async function updateDB() {
    try {``
        console.log("Connecting to DB...");
        
        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log("Connected to DB successfully.");

        console.log("1. Updating FundModel jobbing_settings for all customers...");
        const fundRes = await Fund.updateMany(
            {}, 
            { 
                $set: { 
                    'jobbing_settings.price': 0.08, 
                    'jobbing_settings.type': 'percentage' 
                } 
            }
        );
        console.log(`Updated ${fundRes.modifiedCount} Fund documents (Matched: ${fundRes.matchedCount}).`);

        console.log("2. Updating OrdersModel jobbing_point to 0 for all orders...");
        const orderRes = await Order.updateMany(
            {},
            {
                $set: {
                    jobbing_point: 0
                }
            }
        );
        console.log(`Updated ${orderRes.modifiedCount} Order documents (Matched: ${orderRes.matchedCount}).`);

        console.log("3. Updating BrokerModel default_jobbing to 0.08...");
        const brokerRes = await Broker.updateMany(
            {},
            {
                $set: {
                    default_jobbing_price: 0.08,
                    default_jobbing_type: 'percentage'
                }
            }
        );
        console.log(`Updated ${brokerRes.modifiedCount} Broker documents (Matched: ${brokerRes.matchedCount}).`);

        console.log("All updates complete!");
    } catch (err) {
        console.error("Error updating DB:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from DB.");
    }
}

updateDB();
