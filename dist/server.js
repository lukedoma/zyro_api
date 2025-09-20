"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const dotenv_1 = __importDefault(require("dotenv"));
// Load env **before any other imports**
dotenv_1.default.config({ path: ".env.local" });
require("./index"); // your existing index.ts entry point
