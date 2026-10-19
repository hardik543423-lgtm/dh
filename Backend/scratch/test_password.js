import 'dotenv/config';
import mongoose from 'mongoose';
import Customer from '../Model/CustomerModel.js';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected');

        const customer = await Customer.findOne({ customer_id: '9428978180' }).select('+password +old_password');
        if (!customer) {
            console.log('Customer not found');
            return;
        }

        console.log('Customer info:', {
            id: customer.customer_id,
            name: customer.name,
            password: customer.password,
            old_password: customer.old_password
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
