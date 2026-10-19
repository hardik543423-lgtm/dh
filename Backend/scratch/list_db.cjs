const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

        const usersCol = db.collection('users');
        const userCount = await usersCol.countDocuments();
        console.log("Total users count:", userCount);

        const sampleUsers = await usersCol.find({}).limit(5).toArray();
        console.log("Sample Users:", JSON.stringify(sampleUsers.map(u => ({ id: u._id, phone: u.phone, role: u.role, name: u.name, broker_id: u.broker_id, broker_id_str: u.broker_id_str })), null, 2));

        const fundsCol = db.collection('funds');
        const sampleFunds = await fundsCol.find({}).limit(5).toArray();
        console.log("Sample Funds:", JSON.stringify(sampleFunds, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
