import 'dotenv/config';
import mongoose from 'mongoose';
import Customer from '../Model/CustomerModel.js';
import Broker from '../Model/BrokerModel.js';
import UserWatchlist from '../Model/UserWatchlistModel.js';
import Order from '../Model/OrdersModel.js';

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ MongoDB connected');

        const customers = await Customer.find().limit(5);
        console.log(`\n👥 Total customers in DB: ${await Customer.countDocuments()}`);
        console.log(customers.map(c => ({ id: c.customer_id, name: c.name, broker: c.attached_broker_id })));

        const brokers = await Broker.find().limit(5);
        console.log(`\n🏢 Total brokers in DB: ${await Broker.countDocuments()}`);
        console.log(brokers.map(b => ({ id: b.login_id, name: b.name, org: b.organization_name })));

        const watchlists = await UserWatchlist.find().limit(5);
        console.log(`\n📋 Total watchlists: ${await UserWatchlist.countDocuments()}`);
        console.log(watchlists.map(w => ({ name: w.name, broker: w.broker_id_str, customer: w.customer_id_str, instruments: w.instruments })));

        const orders = await Order.find().limit(5);
        console.log(`\n📦 Total orders: ${await Order.countDocuments()}`);
        console.log(orders.map(o => ({ symbol: o.symbol, broker: o.broker_id_str, customer: o.customer_id_str, status: o.order_status })));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
inspect();
