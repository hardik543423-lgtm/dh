const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

const OrderSchema = new mongoose.Schema(
  {
    broker_id_str: { type: String, required: true },
    customer_id_str: { type: String, required: true },
    instrument_token: { type: String, required: true },
    symbol: { type: String, required: true },
    segment: { type: String },
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    closed_ltp: { type: Number },
    product: { type: String, enum: ["MIS", "NRML"], required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lots: { type: Number, default: 0 },
    lot_size: { type: Number, default: 1 },
    order_status: { type: String },
  },
  { timestamps: true }
);

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const order = await Order.findById('6a7a87020aac48aa93fb90fd');
        console.log("Before update:", order.quantity, order.lots);

        order.quantity = 5;
        order.lots = 5;
        await order.save();

        const order2 = await Order.findById('6a7a87020aac48aa93fb90fd');
        console.log("After update:", order2.quantity, order2.lots);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
