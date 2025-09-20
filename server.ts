// server.ts
import dotenv from "dotenv";
// Load env **before any other imports**
dotenv.config({ path: ".env.local" });

import "./index"; // your existing index.ts entry point
