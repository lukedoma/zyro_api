"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PATCH = PATCH;
const mongodb_1 = require("../lib/mongodb");
const auth_1 = require("../lib/auth");
const mongodb_2 = require("mongodb");
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
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const db = await (0, mongodb_1.getDatabase)();
        if (id) {
            let callDoc = null;
            try {
                callDoc = await db.collection('calls').findOne({ _id: new mongodb_2.ObjectId(id) });
            }
            catch (e) {
                return Response.json({ error: 'Invalid call id' }, { status: 400 });
            }
            if (!callDoc || !callDoc.participants?.includes(user.id)) {
                return Response.json({ error: 'Call not found' }, { status: 404 });
            }
            const otherParticipantIds = callDoc.participants.filter((pid) => pid !== user.id);
            const participants = await db
                .collection('users')
                .find({ _id: { $in: otherParticipantIds.map((pid) => new mongodb_2.ObjectId(pid)) } })
                .project({ displayName: 1, avatar: 1, username: 1 })
                .toArray();
            return Response.json({
                call: {
                    id: callDoc._id.toString(),
                    type: callDoc.type,
                    currentMode: callDoc.currentMode ?? callDoc.type,
                    participants: callDoc.participants,
                    participantDetails: participants.map((p) => ({
                        id: p._id.toString(),
                        name: p.displayName,
                        avatar: p.avatar,
                        username: p.username,
                    })),
                    initiatorId: callDoc.initiatorId,
                    startTime: callDoc.startTime,
                    endTime: callDoc.endTime,
                    duration: callDoc.duration,
                    status: callDoc.status,
                    isEncrypted: callDoc.isEncrypted || false,
                    isPaid: callDoc.isPaid || false,
                    price: callDoc.price,
                },
            });
        }
        const calls = await db
            .collection('calls')
            .find({ participants: user.id })
            .sort({ startTime: -1 })
            .limit(50)
            .toArray();
        const populatedCalls = await Promise.all(calls.map(async (call) => {
            const otherParticipantIds = call.participants.filter((pid) => pid !== user.id);
            const participants = await db
                .collection('users')
                .find({ _id: { $in: otherParticipantIds.map((pid) => new mongodb_2.ObjectId(pid)) } })
                .project({ displayName: 1, avatar: 1, username: 1 })
                .toArray();
            return {
                id: call._id.toString(),
                type: call.type,
                currentMode: call.currentMode ?? call.type,
                participants: call.participants,
                participantDetails: participants.map((p) => ({
                    id: p._id.toString(),
                    name: p.displayName,
                    avatar: p.avatar,
                    username: p.username,
                })),
                initiatorId: call.initiatorId,
                startTime: call.startTime,
                endTime: call.endTime,
                duration: call.duration,
                status: call.status,
                isEncrypted: call.isEncrypted || false,
                isPaid: call.isPaid || false,
                price: call.price,
            };
        }));
        return Response.json({ calls: populatedCalls });
    }
    catch (error) {
        console.error('Get calls error:', error);
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
        const { participantIds, type, isPaid, price } = await request.json();
        if (!participantIds || participantIds.length === 0) {
            return Response.json({ error: 'Participant IDs are required' }, { status: 400 });
        }
        if (!['audio', 'video', 'private', 'conference'].includes(type)) {
            return Response.json({ error: 'Invalid call type' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const call = {
            type,
            currentMode: type === 'video' ? 'video' : 'audio',
            participants: [user.id, ...participantIds],
            initiatorId: user.id,
            startTime: new Date(),
            status: 'active',
            isEncrypted: true,
            isPaid: isPaid || false,
            price: isPaid ? price : null,
            createdAt: new Date(),
        };
        const result = await db.collection('calls').insertOne(call);
        return Response.json({
            callId: result.insertedId.toString(),
            message: 'Call initiated successfully',
        });
    }
    catch (error) {
        console.error('Create call error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function PATCH(request) {
    try {
        const token = (0, auth_1.getAuthHeader)(request);
        if (!token) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = await (0, auth_1.getUserFromToken)(token);
        if (!user) {
            return Response.json({ error: 'Invalid token' }, { status: 401 });
        }
        const body = await request.json();
        const { callId, mode } = body;
        if (!callId || !mode || !['audio', 'video'].includes(mode)) {
            return Response.json({ error: 'callId and mode are required' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        let callObjId;
        try {
            callObjId = new mongodb_2.ObjectId(callId);
        }
        catch {
            return Response.json({ error: 'Invalid call id' }, { status: 400 });
        }
        const callDoc = await db.collection('calls').findOne({ _id: callObjId });
        if (!callDoc || !callDoc.participants?.includes(user.id)) {
            return Response.json({ error: 'Call not found' }, { status: 404 });
        }
        await db.collection('calls').updateOne({ _id: callObjId }, { $set: { currentMode: mode, updatedAt: new Date() } });
        return Response.json({ success: true });
    }
    catch (error) {
        console.error('Update call mode error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
