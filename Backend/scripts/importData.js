/**
 * MongoDB Data Import Script
 * 
 * Reads all JSON files from D:\data and imports them into MongoDB Atlas.
 * File naming convention: test.<collectionName>.json
 * Database name: test
 * 
 * Handles MongoDB Extended JSON v2 format ($oid, $date, etc.)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'D:\\data';
const DB_NAME = 'test';

// Convert MongoDB Extended JSON types to native types
function convertExtendedJSON(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertExtendedJSON(item));
  }

  // Handle $oid
  if (obj.$oid) {
    return new mongoose.Types.ObjectId(obj.$oid);
  }

  // Handle $date
  if (obj.$date) {
    if (typeof obj.$date === 'string') {
      return new Date(obj.$date);
    }
    if (obj.$date.$numberLong) {
      return new Date(parseInt(obj.$date.$numberLong));
    }
    return new Date(obj.$date);
  }

  // Handle $numberLong
  if (obj.$numberLong !== undefined) {
    const val = parseInt(obj.$numberLong);
    return val;
  }

  // Handle $numberDouble
  if (obj.$numberDouble !== undefined) {
    return parseFloat(obj.$numberDouble);
  }

  // Handle $numberInt
  if (obj.$numberInt !== undefined) {
    return parseInt(obj.$numberInt);
  }

  // Handle $numberDecimal
  if (obj.$numberDecimal !== undefined) {
    return mongoose.Types.Decimal128.fromString(obj.$numberDecimal);
  }

  // Handle $binary
  if (obj.$binary) {
    return Buffer.from(obj.$binary.base64 || obj.$binary, 'base64');
  }

  // Handle $regex
  if (obj.$regex !== undefined) {
    return new RegExp(obj.$regex, obj.$options || '');
  }

  // Handle $timestamp
  if (obj.$timestamp) {
    return new mongoose.Types.ObjectId(); // fallback
  }

  // Recursively process nested objects
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertExtendedJSON(obj[key]);
  }
  return result;
}

async function importCollection(db, collectionName, filePath) {
  const fileSize = fs.statSync(filePath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  
  console.log(`\n📂 Importing: ${collectionName} (${fileSizeMB} MB)`);
  console.log(`   File: ${filePath}`);

  try {
    // Read the JSON file
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const documents = JSON.parse(rawData);

    if (!Array.isArray(documents)) {
      console.log(`   ⚠️ File is not a JSON array, skipping.`);
      return;
    }

    console.log(`   📄 Found ${documents.length} documents`);

    if (documents.length === 0) {
      console.log(`   ⏭️ No documents to import, skipping.`);
      return;
    }

    // Convert Extended JSON to native types
    const convertedDocs = documents.map(doc => convertExtendedJSON(doc));

    // Drop existing collection if it exists
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length > 0) {
      await db.dropCollection(collectionName);
      console.log(`   🗑️ Dropped existing collection: ${collectionName}`);
    }

    // Insert in batches of 1000 to handle large collections
    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < convertedDocs.length; i += BATCH_SIZE) {
      const batch = convertedDocs.slice(i, i + BATCH_SIZE);
      await db.collection(collectionName).insertMany(batch, { ordered: false });
      inserted += batch.length;
      
      if (convertedDocs.length > BATCH_SIZE) {
        const pct = ((inserted / convertedDocs.length) * 100).toFixed(0);
        process.stdout.write(`\r   ⏳ Progress: ${inserted}/${convertedDocs.length} (${pct}%)`);
      }
    }

    if (convertedDocs.length > BATCH_SIZE) {
      process.stdout.write('\n');
    }

    console.log(`   ✅ Successfully imported ${inserted} documents into '${collectionName}'`);
  } catch (error) {
    console.error(`   ❌ Error importing ${collectionName}: ${error.message}`);
  }
}

async function main() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

  if (!MONGO_URI) {
    console.error('❌ No MongoDB connection string found in .env (MONGO_URL or MONGODB_URI)');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB Atlas...');
  
  // Connect with database name specified
  const conn = await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  const db = conn.connection.db;
  
  console.log(`✅ Connected to MongoDB Atlas (database: ${DB_NAME})`);

  // Find all JSON files in the data directory
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f.startsWith('test.'))
    .sort();

  console.log(`\n📋 Found ${files.length} collection files to import:`);
  files.forEach(f => {
    const collName = f.replace('test.', '').replace('.json', '');
    const size = (fs.statSync(path.join(DATA_DIR, f)).size / (1024 * 1024)).toFixed(2);
    console.log(`   - ${collName} (${size} MB)`);
  });

  console.log('\n🚀 Starting import...\n' + '═'.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    // Extract collection name: test.brokers.json -> brokers
    const collectionName = file.replace('test.', '').replace('.json', '');
    const filePath = path.join(DATA_DIR, file);

    try {
      await importCollection(db, collectionName, filePath);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed: ${collectionName} — ${err.message}`);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n🎉 Import Complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  if (failCount > 0) console.log(`   ❌ Failed: ${failCount}`);

  // Show final collection stats
  console.log('\n📊 Database Collections Summary:');
  const allCollections = await db.listCollections().toArray();
  for (const col of allCollections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`   📁 ${col.name}: ${count.toLocaleString()} documents`);
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB. Done!');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
