
import { MongoClient } from 'mongodb';

const URI = 'mongodb+srv://devakibrokerage_db_user:2hmSRDFDyuT4bLgJ@newswasthikacluster.snofy1c.mongodb.net/?appName=NewSwasthikaCluster';

async function inspectCounts() {
    const client = new MongoClient(URI);
    try {
        await client.connect();
        const db = client.db();

        const collections = ['brokers', 'customers', 'orders', 'registrations'];
        for (const coll of collections) {
            const count = await db.collection(coll).countDocuments();
            console.log(`${coll}: ${count} documents`);
            if (count > 0) {
                const sample = await db.collection(coll).findOne({});
                if (coll === 'orders') {
                    console.log(`  Sample Order Broker: ${sample.broker_id_str}, Customer: ${sample.customer_id_str}`);
                } else if (coll === 'customers') {
                    console.log(`  Sample Customer ID: ${sample.customer_id}, Attached Broker: ${sample.attached_broker_id}`);
                } else if (coll === 'brokers') {
                    console.log(`  Sample Broker LoginID: ${sample.login_id}`);
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

inspectCounts();
