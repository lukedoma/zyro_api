"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
const mongodb_1 = require("mongodb");
// Load environment variables
// const uri = process.env.MONGODB_URI;
// const uri = "mongodb+srv://lukekubuluvevou_db_user:ipLSQTHhmRWtzgnZ@zyrocluster.ufgzlax.mongodb.net/?retryWrites=true&w=majority&appName=ZyroCluster";
const uri = "mongodb+srv://lukekubuluvevou_db_user:ipLSQTHhmRWtzgnZ@zyrocluster.ufgzlax.mongodb.net/?retryWrites=true&w=majority";
if (!uri) {
    throw new Error("Please add your MongoDB URI to .env.local");
}
// Options for MongoDB connection
const options = {
    // Increase connection timeout for slow networks
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
};
let client;
let clientPromise;
// Global variable for dev to prevent multiple connections
if (process.env.NODE_ENV === "development") {
    let globalWithMongo = global;
    if (!globalWithMongo._mongoClientPromise) {
        client = new mongodb_1.MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect().catch((err) => {
            console.error("MongoDB connection error:", err);
            throw err;
        });
    }
    clientPromise = globalWithMongo._mongoClientPromise;
}
else {
    // Production: no global caching
    client = new mongodb_1.MongoClient(uri, options);
    clientPromise = client.connect().catch((err) => {
        console.error("MongoDB connection error:", err);
        throw err;
    });
}
/**
 * Returns the MongoDB database instance.
 */
async function getDatabase() {
    const client = await clientPromise;
    // Default database name, or you can parse it from URI
    const dbName = process.env.MONGODB_DB || "zyro";
    return client.db(dbName);
}
exports.default = clientPromise;
