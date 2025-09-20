"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
async function GET(request) {
    try {
        if (!request) {
            return Response.json({ error: 'Invalid request' }, { status: 400 });
        }
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        // Check if user is admin
        const db = await (0, mongodb_1.getDatabase)();
        const adminUser = await db.collection('admins').findOne({ userId: user.id });
        if (!adminUser) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const search = url.searchParams.get('search') || '';
        let query = {};
        if (search) {
            query = {
                $or: [
                    { displayName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            };
        }
        const users = await db.collection('users')
            .find(query)
            .project({ password: 0, privateKey: 0 })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        const total = await db.collection('users').countDocuments(query);
        return Response.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function PATCH(request) {
    try {
        if (!request) {
            return Response.json({ error: 'Invalid request' }, { status: 400 });
        }
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const adminUser = await db.collection('admins').findOne({ userId: user.id });
        if (!adminUser) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const { userId, action, reason } = await request.json();
        if (!userId || !action) {
            return Response.json({ error: 'User ID and action are required' }, { status: 400 });
        }
        if (action === 'block') {
            await db.collection('blocked_users').insertOne({
                userId,
                reason: reason || 'Blocked by admin',
                blockedBy: user.id,
                blockedAt: new Date(),
                isActive: true
            });
        }
        else if (action === 'unblock') {
            await db.collection('blocked_users').updateOne({ userId, isActive: true }, {
                $set: {
                    unblockedAt: new Date(),
                    isActive: false
                }
            });
        }
        else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
        return Response.json({ message: `User ${action}ed successfully` });
    }
    catch (error) {
        console.error('User action error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
