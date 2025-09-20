import { MongoClient, Db } from "mongodb";

// Load environment variables
const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Please add your MongoDB URI to .env.local");
}

// Options for MongoDB connection
const options = {
  // Increase connection timeout for slow networks
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Global variable for dev to prevent multiple connections
if (process.env.NODE_ENV === "development") {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect().catch((err) => {
      console.error("MongoDB connection error:", err);
      throw err;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Production: no global caching
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((err) => {
    console.error("MongoDB connection error:", err);
    throw err;
  });
}

/**
 * Returns the MongoDB database instance.
 */
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  // Default database name, or you can parse it from URI
  const dbName = process.env.MONGODB_DB || "zyro";
  return client.db(dbName);
}

export default clientPromise;
