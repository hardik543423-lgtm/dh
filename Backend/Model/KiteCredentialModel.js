// Model/KiteCredentialModel.js
import mongoose from 'mongoose';

const kiteCredentialSchema = new mongoose.Schema({
  api_key: {
    type: String,
    required: true
  },
  api_secret: {
    type: String,
    required: true
  },
  access_token: {
    type: String,
    default: null
  },
  public_token: {
    type: String,
    default: null
  },
  user_id: {
    type: String,
    default: null
  },
  broker: {
    type: String,
    default: 'ZERODHA'
  },
  login_time: {
    type: Date,
    default: null
  },
  token_expiry: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Auto-login credentials (encrypted)
  kite_password: {
    type: String,
    default: null  // Stored encrypted with AES-256
  },
  totp_secret: {
    type: String,
    default: null  // Stored encrypted with AES-256
  },
  // Auto-login settings
  auto_login_enabled: {
    type: Boolean,
    default: false
  },
  last_auto_login: {
    type: Date,
    default: null
  },
  auto_login_error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Ensure fast lookup on is_active and api_key
kiteCredentialSchema.index({ is_active: 1, api_key: 1 });

/**
 * Static method to reliably get the current active Kite credential
 */
kiteCredentialSchema.statics.getActive = async function(lean = false) {
  const envApiKey = process.env.KITE_API_KEY;
  let query = this.findOne(
    envApiKey ? { api_key: envApiKey, is_active: true } : { is_active: true }
  ).sort({ updatedAt: -1 });

  if (lean) query = query.lean();
  let cred = await query;

  // Fallback if not found with envApiKey + is_active
  if (!cred && envApiKey) {
    let fallbackQuery = this.findOne({ api_key: envApiKey }).sort({ updatedAt: -1 });
    if (lean) fallbackQuery = fallbackQuery.lean();
    cred = await fallbackQuery;
  }

  // Fallback to any active credential
  if (!cred) {
    let anyActiveQuery = this.findOne({ is_active: true }).sort({ updatedAt: -1 });
    if (lean) anyActiveQuery = anyActiveQuery.lean();
    cred = await anyActiveQuery;
  }

  return cred;
};

const KiteCredential = mongoose.model('KiteCredential', kiteCredentialSchema);

export default KiteCredential;

