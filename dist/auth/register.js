"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const encryption_1 = require("../lib/encryption");
const crypto_1 = __importDefault(require("crypto"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
async function register(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (password.length < 6) {
            return res
                .status(400)
                .json({ error: "Password must be at least 6 characters" });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const existingUser = await db.collection("users").findOne({ email });
        if (existingUser) {
            return res
                .status(409)
                .json({ error: "User already exists with this email" });
        }
        const username = email.split("@")[0].toLowerCase() +
            Math.random().toString(36).substring(2, 6);
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const { publicKey, privateKey } = (0, encryption_1.generateKeyPair)();
        const verificationCode = crypto_1.default.randomUUID();
        const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
        const user = {
            email,
            username,
            displayName: fullName,
            password: hashedPassword,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            isVerified: false,
            isCreator: false,
            followers: 0,
            following: 0,
            publicKey,
            privateKey,
            verification_code: verificationCode,
            verification_expiresAt: verificationExpiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection("users").insertOne(user);
        const origin = req.headers.origin || process.env.PUBLIC_BASE_URL || "";
        const verificationLink = `${origin}/verify?method=email&code=${verificationCode}&email=${encodeURIComponent(email)}`;
        console.log("DEV email verification link:", verificationLink);
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
            mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
            await mail_1.default.send({
                to: email,
                from: process.env.SENDGRID_FROM,
                subject: "Verify your account",
                html: `<div>Click <a href="${verificationLink}">here</a> to verify your account.</div>`,
            });
        }
        else {
            console.warn("SENDGRID env not set; skipping email send");
        }
        res.status(201).json({
            message: "Verification email sent",
            dev: { code: verificationCode, link: verificationLink },
            userId: result.insertedId.toString(),
            email,
        });
    }
    catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
