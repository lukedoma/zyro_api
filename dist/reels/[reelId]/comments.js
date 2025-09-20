"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const mongodb_1 = require("../../lib/mongodb");
const auth_1 = require("../../lib/auth");
const mongodb_2 = require("mongodb");
async function GET(request) {
    try {
        if (!request || !request.url) {
            return Response.json({ error: 'Invalid request' }, { status: 400 });
        }
        const url = new URL(request.url);
        const reelId = url.pathname.split('/')[3]; // Extract reelId from path
        if (!reelId || reelId.trim().length === 0) {
            return Response.json({ error: 'Invalid reel ID' }, { status: 400 });
        }
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const db = await (0, mongodb_1.getDatabase)();
        // Get comments for the reel
        const comments = await db.collection('comments')
            .find({ reelId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        // Populate user details
        const populatedComments = await Promise.all(comments.map(async (comment) => {
            const user = await db.collection('users')
                .findOne({ _id: new mongodb_2.ObjectId(comment.userId) }, { projection: { displayName: 1, avatar: 1, username: 1 } });
            return {
                id: comment._id.toString(),
                reelId: comment.reelId,
                userId: comment.userId,
                user: {
                    username: user?.username || 'unknown',
                    displayName: user?.displayName || 'Unknown',
                    avatar: user?.avatar || '',
                },
                content: comment.content,
                likes: comment.likes || 0,
                replies: [], // For simplicity, not implementing nested replies
                createdAt: comment.createdAt,
            };
        }));
        return Response.json({
            comments: populatedComments.reverse(), // Return in chronological order
            hasMore: comments.length === limit
        });
    }
    catch (error) {
        console.error('Get comments error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function POST(request) {
    try {
        if (!request || !request.url) {
            return Response.json({ error: 'Invalid request' }, { status: 400 });
        }
        const url = new URL(request.url);
        const reelId = url.pathname.split('/')[3]; // Extract reelId from path
        if (!reelId || reelId.trim().length === 0) {
            return Response.json({ error: 'Invalid reel ID' }, { status: 400 });
        }
        if (!request.headers) {
            return Response.json({ error: 'Invalid request headers' }, { status: 400 });
        }
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        const body = await request.json();
        const { content } = body;
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return Response.json({ error: 'Comment content is required' }, { status: 400 });
        }
        if (content.trim().length > 1000) {
            return Response.json({ error: 'Comment content too long' }, { status: 400 });
        }
        const sanitizedContent = content.trim();
        const db = await (0, mongodb_1.getDatabase)();
        // Check if reel exists
        const reel = await db.collection('reels').findOne({ _id: new mongodb_2.ObjectId(reelId) });
        if (!reel) {
            return Response.json({ error: 'Reel not found' }, { status: 404 });
        }
        // Create new comment
        const comment = {
            reelId,
            userId: user.id,
            content: sanitizedContent,
            likes: 0,
            createdAt: new Date(),
        };
        const result = await db.collection('comments').insertOne(comment);
        // Update reel comment count
        await db.collection('reels').updateOne({ _id: new mongodb_2.ObjectId(reelId) }, { $inc: { comments: 1 } });
        return Response.json({
            commentId: result.insertedId.toString(),
            message: 'Comment added successfully',
        });
    }
    catch (error) {
        console.error('Add comment error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
