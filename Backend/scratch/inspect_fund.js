import 'dotenv/config';
import mongoose from 'mongoose';
import Fund from '../Model/FundModel.js';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected');

        const fund = await Fund.findOne({ customer_id_str: '9428978180' }).lean();
        console.log('Fund document:', JSON.stringify(fund, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
