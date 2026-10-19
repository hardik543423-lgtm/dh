const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const fundsCol = db.collection('funds');
        const customerId = '9600990803';

        const fund = await fundsCol.findOne({ customer_id_str: customerId });
        console.log("Fund record for customer:", customerId, JSON.stringify(fund, null, 2));

        const customersCol = db.collection('users'); // or whatever user collection name is
        const customerUser = await customersCol.findOne({ phone: customerId });
        console.log("Customer User:", JSON.stringify(customerUser, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
