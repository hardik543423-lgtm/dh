const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const fundsCol = db.collection('fundmodels');
        const customersCol = db.collection('customers');
        
        const customerId = '9600990803';

        const fund = await fundsCol.findOne({ customer_id_str: customerId });
        console.log("Fund record for customer:", customerId, JSON.stringify(fund, null, 2));

        const customerUser = await customersCol.findOne({ phone: customerId });
        console.log("Customer User by phone:", JSON.stringify(customerUser, null, 2));

        const customerUserById = await customersCol.findOne({ customer_id_str: customerId });
        console.log("Customer User by customer_id_str:", JSON.stringify(customerUserById, null, 2));

        // Let's print all funds to see what customers exist
        const allFunds = await fundsCol.find({}).toArray();
        console.log("All Funds customer IDs:", allFunds.map(f => ({ customer: f.customer_id_str, broker: f.broker_id_str, intraday: f.intraday, overnight: f.overnight })));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
