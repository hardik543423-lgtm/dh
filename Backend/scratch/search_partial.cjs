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
            const results = await col.find({}).toArray();

            for (const doc of results) {
                const str = JSON.stringify(doc);
                if (str.includes('42362')) {
                    console.log(`Found match in ${colInfo.name}:`, JSON.stringify(doc, null, 2));
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
