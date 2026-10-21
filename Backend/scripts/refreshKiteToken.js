import mongoose from 'mongoose';
import dotenv from 'dotenv';
import KiteCredentialModel from '../Model/KiteCredentialModel.js';
import { performAutoLogin } from '../services/AutoLoginService.js';

dotenv.config();

async function refreshKiteToken() {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.createConnection(process.env.MONGO_URL).asPromise();
    console.log('Connected to MongoDB');

    const targetApiKey = process.env.KITE_API_KEY || '564nflzok9wyizl0';
    console.log('Target API Key:', targetApiKey);

    for (const dbName of ['PORT=8080', 'devaki']) {
        const useDb = conn.useDb(dbName);
        const KiteCredential = useDb.model('KiteCredential', KiteCredentialModel.schema);

        // Deactivate old credentials
        const deact = await KiteCredential.updateMany(
            { api_key: { $ne: targetApiKey } },
            { $set: { is_active: false, auto_login_enabled: false } }
        );
        console.log(`[${dbName}] Deactivated old credentials count:`, deact.modifiedCount);

        // Ensure target one is active
        const act = await KiteCredential.updateOne(
            { api_key: targetApiKey },
            { $set: { is_active: true, auto_login_enabled: true } }
        );
        console.log(`[${dbName}] Activated target credential count:`, act.modifiedCount);
    }

    // Now perform full auto login on PORT=8080
    const useDb = conn.useDb('PORT=8080');
    const KiteCredential = useDb.model('KiteCredential', KiteCredentialModel.schema);

    const validCred = await KiteCredential.findOne({ api_key: targetApiKey, is_active: true });
    if (!validCred) {
        throw new Error(`No credential found for api_key ${targetApiKey}`);
    }

    console.log(`Starting auto-login for user ${validCred.user_id}...`);
    const result = await performAutoLogin(validCred);

    if (result.success) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1);
        expiry.setHours(6, 0, 0, 0);

        for (const dbName of ['PORT=8080', 'devaki']) {
            const dbInstance = conn.useDb(dbName);
            const CredModel = dbInstance.model('KiteCredential', KiteCredentialModel.schema);

            await CredModel.updateOne(
                { api_key: targetApiKey },
                {
                    $set: {
                        access_token: result.access_token,
                        public_token: result.public_token,
                        user_id: result.user_id,
                        login_time: new Date(result.login_time),
                        token_expiry: expiry,
                        last_auto_login: new Date(),
                        auto_login_error: null,
                        is_active: true,
                        auto_login_enabled: true
                    }
                }
            );
            console.log(`[${dbName}] ✅ Database updated with new access token! Expiry: ${expiry.toISOString()}`);
        }

        console.log('==============================================');
        console.log('✅ TOKEN REFRESH COMPLETE!');
        console.log('User ID:', result.user_id);
        console.log('Access Token:', result.access_token.substring(0, 10) + '...');
        console.log('Expires at:', expiry.toISOString());
        console.log('==============================================');
    }

    await conn.close();
    process.exit(0);
}

refreshKiteToken().catch((err) => {
    console.error('❌ Failed to refresh token:', err);
    process.exit(1);
});
