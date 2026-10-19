
import { MongoClient } from 'mongodb';

const URI = 'mongodb+srv://devakibrokerage_db_user:2hmSRDFDyuT4bLgJ@newswasthikacluster.snofy1c.mongodb.net/?appName=NewSwasthikaCluster';

async function checkWatchlistInstruments() {
    const client = new MongoClient(URI);
    try {
        await client.connect();
        const db = client.db();

        const customerId = '7871939446';
        const watchlist = await db.collection('userwatchlists').findOne({ customer_id_str: customerId });

        if (!watchlist) {
            console.log('Watchlist NOT FOUND');
            return;
        }

        console.log(`Watchlist for ${customerId} has ${watchlist.instruments?.length || 0} items.`);

        if (watchlist.instruments?.length > 0) {
            const sampleKeys = watchlist.instruments.slice(0, 5);
            console.log('Sample Keys:', sampleKeys);

            const foundInstruments = await db.collection('instruments').find({ canon_key: { $in: sampleKeys } }).toArray();
            console.log('Found in instruments collection:', foundInstruments.length);
            if (foundInstruments.length > 0) {
                console.log('Sample found instrument:', {
                    canon_key: foundInstruments[0].canon_key,
                    instrument_token: foundInstruments[0].instrument_token,
                    tradingsymbol: foundInstruments[0].tradingsymbol
                });
            }
        }

        // Also check total instruments count
        const totalInstruments = await db.collection('instruments').countDocuments();
        console.log('Total instruments in DB:', totalInstruments);

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

checkWatchlistInstruments();
