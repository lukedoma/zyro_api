"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.getUserFromToken = getUserFromToken;
exports.getAuthHeader = getAuthHeader;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongodb_1 = require("./mongodb");
const mongodb_2 = require("mongodb");
if (!process.env.JWT_SECRET) {
    throw new Error('Please add your JWT_SECRET to .env.local');
}
const JWT_SECRET = process.env.JWT_SECRET;
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
async function verifyPassword(password, hashedPassword) {
    return bcryptjs_1.default.compare(password, hashedPassword);
}
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        username: user.username,
    }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch {
        return null;
    }
}
async function getUserFromToken(token) {
    const decoded = verifyToken(token);
    if (!decoded)
        return null;
    const db = await (0, mongodb_1.getDatabase)();
    const user = await db.collection('users').findOne({ _id: new mongodb_2.ObjectId(decoded.id) });
    if (!user)
        return null;
    return {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isVerified: user.isVerified || false,
        isCreator: user.isCreator || false,
    };
}
function getAuthHeader(req) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
