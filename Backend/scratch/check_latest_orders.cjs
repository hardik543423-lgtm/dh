const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const ordersCol = db.collection('orders');
        
        const latestOrders = await ordersCol.find({}).sort({ updatedAt: -1 }).limit(10).toArray();
        console.log("Latest 10 Orders:", JSON.stringify(latestOrders.map(o => ({
            id: o._id,
            symbol: o.symbol,
            side: o.side,
            order_status: o.order_status,
            customer: o.customer_id_str,
            broker: o.broker_id_str,
            updatedAt: o.updatedAt,
            came_From: o.came_From
        })), null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
