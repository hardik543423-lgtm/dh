const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://devakibrokerage_db_user:2hmSRDFDyuT4bLgJ@newswasthikacluster.snofy1c.mongodb.net/test?appName=NewSwasthikaCluster').then(async () => {
  try {
    const col = mongoose.connection.db.collection('userwatchlists');
    const legacy = await col.find({ name: { $exists: false } }).toArray();
    for (const doc of legacy) {
       const hasMain = await col.findOne({ broker_id_str: doc.broker_id_str, customer_id_str: doc.customer_id_str, name: 'Main Watchlist' });
       if (hasMain) {
          await col.updateOne({ _id: hasMain._id }, { $set: { name: 'Main Watchlist (New)' } });
       }
       await col.updateOne({ _id: doc._id }, { $set: { name: 'Main Watchlist' } });
    }
    console.log('Fixed DB names!');
  } catch(e) { console.log(e); }
  mongoose.disconnect();
});
