const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const ordersCol = db.collection('orders');
        
        const order = await ordersCol.findOne({ _id: new mongoose.Types.ObjectId("6a7a87020aac48aa93fb90fd") });
        console.log("CIPLA Order:", JSON.stringify(order, null, 2));

        const fundCol = db.collection('fundmodels');
        const fund = await fundCol.findOne({ customer_id_str: "9600990803", broker_id_str: "4236230845" });
        console.log("Customer Fund Model:", JSON.stringify(fund, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
