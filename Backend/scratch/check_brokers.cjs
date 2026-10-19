const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const brokersCol = db.collection('brokers');
        
        const allBrokers = await brokersCol.find({}).toArray();
        console.log("All Brokers:", JSON.stringify(allBrokers, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
