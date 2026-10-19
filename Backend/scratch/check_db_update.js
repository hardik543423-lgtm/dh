import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

async function checkInstruments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        const InstrumentSchema = new mongoose.Schema({}, { strict: false });
        const Instrument = mongoose.model("Instrument", InstrumentSchema, "instruments");

        const count = await Instrument.countDocuments();
        console.log(`Total instruments: ${count}`);

        const lastUpdated = await Instrument.findOne().sort({ updatedAt: -1 });
        if (lastUpdated) {
            console.log(`Last updated instrument: ${lastUpdated.tradingsymbol}`);
            console.log(`Last update time: ${lastUpdated.updatedAt}`);
            console.log(`Current time: ${new Date()}`);
        } else {
            console.log("No instruments found.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

checkInstruments();
