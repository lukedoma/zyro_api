"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const mongodb_2 = require("mongodb");
async function GET(request) {
    try {
        const token = (0, auth_1.getAuthHeader)(request);
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const userId = url.searchParams.get('userId');
        const db = await (0, mongodb_1.getDatabase)();
        let currentUser = null;
        if (token) {
            currentUser = await (0, auth_1.getUserFromToken)(token);
        }
        let query = {};
        if (userId) {
            query.creatorId = userId;
        }
        // Get reels with pagination
        const reels = await db.collection('reels')
            .find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        // Populate creator details and follow status
        const populatedReels = await Promise.all(reels.map(async (reel) => {
            const creator = await db.collection('users')
                .findOne({ _id: new mongodb_2.ObjectId(reel.creatorId) }, { projection: { displayName: 1, avatar: 1, username: 1, isVerified: 1 } });
            // Check if current user is following the creator
            let isFollowing = false;
            let userHasLiked = false;
            let userReaction = null;
            if (currentUser) {
                const followCheck = await db.collection('follows')
                    .findOne({
                    followerId: currentUser.id,
                    followingId: reel.creatorId
                });
                isFollowing = !!followCheck;
                // Check if user has reacted to this reel
                const reactionCheck = await db.collection('reactions')
                    .findOne({
                    userId: currentUser.id,
                    contentId: reel._id.toString(),
                    contentType: 'reel'
                });
                if (reactionCheck) {
                    userHasLiked = true;
                    userReaction = reactionCheck.type;
                }
            }
            return {
                id: reel._id.toString(),
                creatorId: reel.creatorId,
                creator: {
                    username: creator?.username || 'unknown',
                    displayName: creator?.displayName || 'Unknown',
                    avatar: creator?.avatar || '',
                    isVerified: creator?.isVerified || false,
                    isFollowing,
                },
                title: reel.title,
                description: reel.description,
                thumbnail: reel.thumbnail,
                videoUrl: reel.videoUrl,
                duration: reel.duration,
                likes: reel.likes || 0,
                comments: reel.comments || 0,
                shares: reel.shares || 0,
                views: reel.views || 0,
                isPaid: reel.isPaid || false,
                price: reel.price,
                tags: reel.tags || [],
                createdAt: reel.createdAt,
                userHasLiked,
                userReaction,
            };
        }));
        return Response.json({
            reels: populatedReels,
            hasMore: reels.length === limit
        });
    }
    catch (error) {
        console.error('Get reels error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function POST(request) {
    try {
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        const { title, description, videoUrl, thumbnail, duration, isPaid, price, tags } = await request.json();
        if (!title || !videoUrl || !thumbnail) {
            return Response.json({ error: 'Title, video URL, and thumbnail are required' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        // Create new reel
        const reel = {
            creatorId: user.id,
            title,
            description: description || '',
            videoUrl,
            thumbnail,
            duration: duration || 0,
            likes: 0,
            comments: 0,
            shares: 0,
            views: 0,
            isPaid: isPaid || false,
            price: isPaid ? price : null,
            tags: tags || [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('reels').insertOne(reel);
        return Response.json({
            reelId: result.insertedId.toString(),
            message: 'Reel created successfully',
        });
    }
    catch (error) {
        console.error('Create reel error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
