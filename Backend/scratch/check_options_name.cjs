const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://rahulsinh8989_db_user:QChlpKW49bvXumRd@cluster0.ddfmkvm.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(mongoUrl);
        console.log("Connected to MongoDB");

        const db = mongoose.connection.db;
        const instrumentsCol = db.collection('instruments');

        // Check if there are options for SENSEX in BFO-OPT
        const sensexOptionsCount = await instrumentsCol.countDocuments({
            name: 'SENSEX',
            segment: 'BFO-OPT'
        });
        console.log("SENSEX BFO-OPT options count:", sensexOptionsCount);

        const sensexExpiries = await instrumentsCol.distinct('expiry', {
            name: 'SENSEX',
            segment: 'BFO-OPT'
        });
        console.log("SENSEX BFO-OPT expiries:", sensexExpiries);

        // Check if there are options for BANKEX in BFO-OPT
        const bankexOptionsCount = await instrumentsCol.countDocuments({
            name: 'BANKEX',
            segment: 'BFO-OPT'
        });
        console.log("BANKEX BFO-OPT options count:", bankexOptionsCount);

        const bankexExpiries = await instrumentsCol.distinct('expiry', {
            name: 'BANKEX',
            segment: 'BFO-OPT'
        });
        console.log("BANKEX BFO-OPT expiries:", bankexExpiries);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
