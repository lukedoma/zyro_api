"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const mongodb_2 = require("mongodb");
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
        const db = await (0, mongodb_1.getDatabase)();
        const adminUser = await db.collection('admins').findOne({ userId: user.id });
        if (!adminUser) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const reportedContent = await db.collection('reported_content')
            .find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .toArray();
        return Response.json({ reportedContent });
    }
    catch (error) {
        console.error('Get reported content error:', error);
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
        const { contentId, action } = await request.json();
        if (!contentId || !action) {
            return Response.json({ error: 'Content ID and action are required' }, { status: 400 });
        }
        const updateData = {
            reviewedBy: user.id,
            reviewedAt: new Date()
        };
        if (action === 'approve') {
            updateData.status = 'resolved';
        }
        else if (action === 'remove') {
            updateData.status = 'resolved';
            // Remove the content
            const reported = await db.collection('reported_content').findOne({ _id: new mongodb_2.ObjectId(contentId) });
            if (reported) {
                if (reported.contentType === 'reel') {
                    await db.collection('reels').deleteOne({ _id: new mongodb_2.ObjectId(reported.contentId) });
                }
                else if (reported.contentType === 'comment') {
                    await db.collection('comments').deleteOne({ _id: new mongodb_2.ObjectId(reported.contentId) });
                }
            }
        }
        else if (action === 'dismiss') {
            updateData.status = 'dismissed';
        }
        await db.collection('reported_content').updateOne({ _id: new mongodb_2.ObjectId(contentId) }, { $set: updateData });
        return Response.json({ message: 'Content reviewed successfully' });
    }
    catch (error) {
        console.error('Review content error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
