const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const customersCol = db.collection('customers');
        
        const customer = await customersCol.findOne({ _id: new mongoose.Types.ObjectId("6a5e555c8276dc84f3ae81dc") });
        console.log("Ravi kumar exact:", JSON.stringify(customer, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
