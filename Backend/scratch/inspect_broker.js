import 'dotenv/config';
import mongoose from 'mongoose';
import Broker from '../Model/BrokerModel.js';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected');

        const broker = await Broker.findOne({ login_id: '8548490083' }).select('+password');
        if (!broker) {
            console.log('Broker not found');
            return;
        }

        console.log('Broker info:', {
            id: broker.login_id,
            name: broker.name,
            password: broker.password
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
