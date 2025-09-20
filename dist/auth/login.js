"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
async function POST(request) {
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return Response.json({ error: 'Email and password are required' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return Response.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        const isValidPassword = await (0, auth_1.verifyPassword)(password, user.password);
        if (!isValidPassword) {
            return Response.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        if (!user.isVerified) {
            return Response.json({ error: 'Account not verified. Please verify your account before logging in.' }, { status: 403 });
        }
        const authUser = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            isVerified: user.isVerified || false,
            isCreator: user.isCreator || false,
        };
        const token = (0, auth_1.generateToken)(authUser);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        return Response.json({
            user: authUser,
            token,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
