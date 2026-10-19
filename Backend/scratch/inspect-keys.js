import 'dotenv/config';
import mongoose from 'mongoose';
import Instrument from '../Model/InstrumentModel.js';
import UserWatchlist from '../Model/UserWatchlistModel.js';

async function checkKeys() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ MongoDB connected');

        // Get one watchlist with instruments
        const wl = await UserWatchlist.findOne({ instruments: { $exists: true, $not: { $size: 0 } } });
        if (!wl) {
            console.log('No watchlists with instruments found!');
            return;
        }

        console.log(`Watchlist Name: ${wl.name}`);
        console.log('Watchlist keys (sample):', wl.instruments.slice(0, 5));

        // Let's search for these keys in Instruments
        const found = await Instrument.find({ canon_key: { $in: wl.instruments } });
        console.log(`Matched instruments in DB: ${found.length} / ${wl.instruments.length}`);

        // Read a sample instrument from database to see its canon_key format
        const instSample = await Instrument.findOne();
        if (instSample) {
            console.log('Sample Instrument from DB:', {
                canon_key: instSample.canon_key,
                tradingsymbol: instSample.tradingsymbol,
                exchange: instSample.exchange,
                segment: instSample.segment
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
checkKeys();
