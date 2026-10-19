import 'dotenv/config';
import Fund from '../Model/FundModel.js';
import mongoose from 'mongoose';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected');

        // 1. Set to 10 first
        await Fund.updateOne(
            { customer_id_str: '9428978180', broker_id_str: '8548490083' },
            { $set: { option_limit_percentage: 10 } }
        );
        let doc = await Fund.findOne({ customer_id_str: '9428978180' });
        console.log('Initial percentage in DB:', doc.option_limit_percentage);

        // 2. Login as broker to get token
        const loginRes = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: '8548490083',
                password: '2005'
            })
        });
        const loginData = await loginRes.json();
        console.log('Login status:', loginRes.status);
        if (!loginData.success) {
            console.log('Login failed');
            return;
        }
        const token = loginData.token;

        // 3. Call API to update to 15
        const res = await fetch('http://localhost:8080/api/funds/updateOptionLimitPercentage', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                broker_id_str: '8548490083',
                customer_id_str: '9428978180',
                percentage: 15
            })
        });
        const data = await res.json();
        console.log('API Response status:', res.status);
        console.log('API Response:', data);

        // 4. Inspect database again
        doc = await Fund.findOne({ customer_id_str: '9428978180' });
        console.log('Updated percentage in DB:', doc.option_limit_percentage);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
