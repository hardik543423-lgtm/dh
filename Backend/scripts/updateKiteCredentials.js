// scripts/updateKiteCredentials.js
// Directly update Kite credentials in database with encrypted password & TOTP
// Usage: node scripts/updateKiteCredentials.js

import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Encryption (same as AutoLoginService.js) ──
const getEncryptionKey = () => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-change-in-production!';
    return crypto.createHash('sha256').update(key).digest();
};

function encrypt(text) {
    if (!text) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

// ── New Credentials ──
const NEW_API_KEY = process.env.KITE_API_KEY;
const NEW_API_SECRET = process.env.KITE_API_SECRET;
const ZERODHA_PASSWORD = 'Vipul@7180';
const TOTP_SECRET = 'Q4HRS2COQRPRS5RQJF5MU2UO2DJ56HNO';

async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   KITE CREDENTIALS UPDATE SCRIPT              ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!mongoUrl) {
        console.error('❌ MONGO_URL not found in .env');
        process.exit(1);
    }

    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    // Get the KiteCredentials collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('kitecredentials');

    // Find active credential
    const existing = await collection.findOne({ is_active: true });

    if (!existing) {
        console.error('❌ No active Kite credential found in database');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`📋 Found existing credential for user: ${existing.user_id}`);
    console.log(`   Old API Key: ${existing.api_key}`);
    console.log(`   New API Key: ${NEW_API_KEY}`);

    // Encrypt password and TOTP
    const encryptedPassword = encrypt(ZERODHA_PASSWORD);
    const encryptedTotp = encrypt(TOTP_SECRET);

    console.log('\n🔐 Encrypting credentials...');
    console.log(`   Password encrypted: ${encryptedPassword.substring(0, 30)}...`);
    console.log(`   TOTP encrypted: ${encryptedTotp.substring(0, 30)}...`);

    // Update database
    const result = await collection.updateOne(
        { _id: existing._id },
        {
            $set: {
                api_key: NEW_API_KEY,
                api_secret: NEW_API_SECRET,
                kite_password: encryptedPassword,
                totp_secret: encryptedTotp,
                auto_login_enabled: true,
                auto_login_error: null,
                updatedAt: new Date()
            }
        }
    );

    if (result.modifiedCount === 1) {
        console.log('\n✅ DATABASE UPDATED SUCCESSFULLY!');
        console.log('   ✅ API Key updated');
        console.log('   ✅ API Secret updated');
        console.log('   ✅ Password encrypted & saved');
        console.log('   ✅ TOTP Secret encrypted & saved');
        console.log('   ✅ Auto-login enabled');
    } else {
        console.log('\n⚠️ No changes made. Document may already be up to date.');
    }

    // Verify
    const updated = await collection.findOne({ _id: existing._id });
    console.log('\n📋 Verification:');
    console.log(`   API Key: ${updated.api_key}`);
    console.log(`   API Secret: ${updated.api_secret.substring(0, 10)}...`);
    console.log(`   Password: ${updated.kite_password ? '✅ Encrypted' : '❌ Missing'}`);
    console.log(`   TOTP: ${updated.totp_secret ? '✅ Encrypted' : '❌ Missing'}`);
    console.log(`   Auto-login: ${updated.auto_login_enabled ? '✅ Enabled' : '❌ Disabled'}`);

    await mongoose.disconnect();
    console.log('\n✅ Done! Now restart the server and do manual login first.');
    console.log('   Browser: http://localhost:8080/api/kite/login-url\n');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
