import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserWatchlistSchema = new Schema({
  broker_id_str : {
    type : String,
    required : true,
  },
  customer_id_str : {
    type : String,
    required : true,
  },
  name: {
    type: String,
    required: true,
    default: 'Watchlist 1'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  instruments: [{
    type: String, 
  }],
}, { timestamps: true });

// Create a compound unique index
// This ensures uniqueness per watchlist name per broker+customer pair
UserWatchlistSchema.index({ broker_id_str: 1, customer_id_str: 1, name: 1 }, { unique: true });

export default mongoose.model('UserWatchlist', UserWatchlistSchema);