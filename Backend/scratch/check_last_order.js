import mongoose from "mongoose";
import Order from "../Model/OrdersModel.js";

const MONGO_URL = "mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0";

async function run() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB");

  const lastOrders = await Order.find({ order_status: "CLOSED" })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  console.log("Last 3 closed orders in DB:", JSON.stringify(lastOrders, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
