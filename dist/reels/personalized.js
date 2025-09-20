"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const mongodb_2 = require("mongodb");
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
        const { reelId, type, metadata } = await request.json();
        if (!reelId || !type) {
            return Response.json({ error: 'Reel ID and interaction type are required' }, { status: 400 });
        }
        const validTypes = ['view', 'like', 'comment', 'share'];
        if (!validTypes.includes(type)) {
            return Response.json({ error: 'Invalid interaction type' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        // Check if reel exists
        const reel = await db.collection('reels')
            .findOne({ _id: new mongodb_2.ObjectId(reelId) });
        if (!reel) {
            return Response.json({ error: 'Reel not found' }, { status: 404 });
        }
        // Calculate interaction weight based on type
        const weights = {
            view: 1,
            like: 3,
            comment: 5,
            share: 7
        };
        // Create interaction record
        const interaction = {
            userId: user.id,
            reelId,
            creatorId: reel.creatorId,
            type,
            weight: weights[type],
            metadata: metadata || {},
            createdAt: new Date(),
        };
        await db.collection('interactions').insertOne(interaction);
        // Update reel stats
        const updateField = type === 'view' ? 'views' : `${type}s`;
        await db.collection('reels').updateOne({ _id: new mongodb_2.ObjectId(reelId) }, { $inc: { [updateField]: 1 } });
        return Response.json({
            message: 'Interaction recorded successfully'
        });
    }
    catch (error) {
        console.error('Record interaction error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function GET(request) {
    try {
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const algorithm = url.searchParams.get('algorithm') || 'following'; // 'following' or 'discover'
        const db = await (0, mongodb_1.getDatabase)();
        let reels = [];
        if (algorithm === 'following') {
            // Get reels from followed users
            const followedUsers = await db.collection('follows')
                .find({ followerId: user.id })
                .toArray();
            const followedUserIds = followedUsers.map(f => f.followingId);
            if (followedUserIds.length > 0) {
                reels = await db.collection('reels')
                    .find({ creatorId: { $in: followedUserIds } })
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .toArray();
            }
        }
        else {
            // Discover algorithm - personalized feed
            const userInteractions = await db.collection('interactions')
                .find({ userId: user.id })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            // Get creators user has interacted with
            const interactedCreators = [...new Set(userInteractions.map(i => i.creatorId))];
            // Get users the current user follows
            const followedUsers = await db.collection('follows')
                .find({ followerId: user.id })
                .toArray();
            const followedUserIds = followedUsers.map(f => f.followingId);
            // Combine followed users and interacted creators
            const preferredCreators = [...new Set([...followedUserIds, ...interactedCreators])];
            // Build aggregation pipeline for personalized feed
            const pipeline = [
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
                    }
                },
                {
                    $addFields: {
                        algorithmScore: {
                            $add: [
                                // Base engagement score
                                { $multiply: ['$likes', 1] },
                                { $multiply: ['$comments', 2] },
                                { $multiply: ['$shares', 3] },
                                { $multiply: ['$views', 0.1] },
                                // Boost for followed creators
                                {
                                    $cond: [
                                        { $in: ['$creatorId', preferredCreators] },
                                        50,
                                        0
                                    ]
                                },
                                // Recency boost
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                { $subtract: [new Date(), '$createdAt'] },
                                                1000 * 60 * 60 * 24 // Convert to days
                                            ]
                                        },
                                        -2 // Negative to boost recent content
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $sort: { algorithmScore: -1, createdAt: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit }
            ];
            reels = await db.collection('reels')
                .aggregate(pipeline)
                .toArray();
        }
        // Populate creator details and check follow status
        const populatedReels = await Promise.all(reels.map(async (reel) => {
            const creator = await db.collection('users')
                .findOne({ _id: new mongodb_2.ObjectId(reel.creatorId) }, { projection: { displayName: 1, avatar: 1, username: 1, isVerified: 1 } });
            // Check if user is following the creator
            const isFollowing = await db.collection('follows')
                .findOne({
                followerId: user.id,
                followingId: reel.creatorId
            });
            // Check if user has liked this reel
            const userReaction = await db.collection('reactions')
                .findOne({
                userId: user.id,
                contentId: reel._id.toString(),
                contentType: 'reel'
            });
            return {
                id: reel._id.toString(),
                creatorId: reel.creatorId,
                creator: {
                    username: creator?.username || 'unknown',
                    displayName: creator?.displayName || 'Unknown',
                    avatar: creator?.avatar || '',
                    isVerified: creator?.isVerified || false,
                    isFollowing: !!isFollowing,
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
                algorithmScore: reel.algorithmScore,
                userHasLiked: !!userReaction,
                userReaction: userReaction?.type,
            };
        }));
        return Response.json({
            reels: populatedReels,
            hasMore: reels.length === limit
        });
    }
    catch (error) {
        console.error('Get personalized reels error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
