"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
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
        const ads = await db.collection('ads')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        return Response.json({ ads });
    }
    catch (error) {
        console.error('Get ads error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function POST(request) {
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
        const { title, description, imageUrl, targetUrl, type, placement, startDate, endDate, budget } = await request.json();
        if (!title || !imageUrl || !targetUrl || !type || !placement || !startDate || !budget) {
            return Response.json({ error: 'Required fields missing' }, { status: 400 });
        }
        const ad = {
            title,
            description: description || '',
            imageUrl,
            targetUrl,
            type,
            placement,
            isActive: true,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            budget,
            spent: 0,
            impressions: 0,
            clicks: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('ads').insertOne(ad);
        return Response.json({
            adId: result.insertedId.toString(),
            message: 'Ad created successfully',
        });
    }
    catch (error) {
        console.error('Create ad error:', error);
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
        const { adId, updates } = await request.json();
        if (!adId || !updates) {
            return Response.json({ error: 'Ad ID and updates are required' }, { status: 400 });
        }
        await db.collection('ads').updateOne({ _id: new mongodb_2.ObjectId(adId) }, {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        });
        return Response.json({ message: 'Ad updated successfully' });
    }
    catch (error) {
        console.error('Update ad error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function DELETE(request) {
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
        const url = new URL(request.url);
        const adId = url.searchParams.get('adId');
        if (!adId) {
            return Response.json({ error: 'Ad ID is required' }, { status: 400 });
        }
        await db.collection('ads').deleteOne({ _id: new mongodb_2.ObjectId(adId) });
        return Response.json({ message: 'Ad deleted successfully' });
    }
    catch (error) {
        console.error('Delete ad error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
