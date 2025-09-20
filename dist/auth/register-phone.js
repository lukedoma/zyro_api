"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerPhone;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const crypto_1 = __importDefault(require("crypto"));
async function registerPhone(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const { fullName, phone, password } = req.body;
        if (!fullName || !phone || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (password.length < 6) {
            return res
                .status(400)
                .json({ error: "Password must be at least 6 characters" });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const existingUser = await db.collection("users").findOne({ phone });
        if (existingUser) {
            return res
                .status(409)
                .json({ error: "User already exists with this phone number" });
        }
        const username = phone.replace(/\D/g, "") + Math.random().toString(36).substring(2, 6);
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const verificationCode = crypto_1.default.randomInt(100000, 999999); // 6-digit code
        const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
        const user = {
            phone,
            username,
            displayName: fullName,
            password: hashedPassword,
            isVerified: false,
            verification_code: verificationCode,
            verification_expiresAt: verificationExpiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection("users").insertOne(user);
        // Here you could integrate SMS sending via Twilio or other provider
        console.log("DEV phone verification code:", verificationCode);
        res.status(201).json({
            message: "Verification code sent to phone",
            dev: { code: verificationCode },
            userId: result.insertedId.toString(),
            phone,
        });
    }
    catch (err) {
        console.error("Phone registration error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
