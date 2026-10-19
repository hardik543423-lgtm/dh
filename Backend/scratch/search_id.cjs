const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        for (const colInfo of collections) {
            const col = db.collection(colInfo.name);
            const results = await col.find({
                $or: [
                    { broker_id_str: '423620845' },
                    { customer_id_str: '423620845' },
                    { login_id: '423620845' },
                    { customer_id: '423620845' },
                    { phone: '423620845' },
                    { attached_broker_id: '423620845' },
                    { broker_id: '423620845' }
                ]
            }).toArray();

            if (results.length > 0) {
                console.log(`Found in collection ${colInfo.name}:`, JSON.stringify(results, null, 2));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
