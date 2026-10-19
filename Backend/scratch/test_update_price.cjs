const axios = require('axios');

async function run() {
    try {
        const payload = {
            order_id: '6a7a87020aac48aa93fb90fd',
            quantity: 5,
            price: 1400,
            closed_at: new Date().toISOString()
        };

        const res = await axios.post('http://localhost:8080/api/orders/updateClosedOrderPrices', payload);
        console.log("Response:", res.data);

    } catch (e) {
        console.error("Error calling API:", e.response?.data || e.message);
    }
}

run();
