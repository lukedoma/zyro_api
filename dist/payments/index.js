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
        const { amount, currency, paymentMethod, contentId, contentType, recipientId } = await request.json();
        if (!amount || !currency || !paymentMethod || !recipientId) {
            return Response.json({ error: 'Amount, currency, payment method, and recipient are required' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        // Create payment record
        const payment = {
            payerId: user.id,
            recipientId,
            amount,
            currency,
            paymentMethod, // 'card', 'bitcoin', 'crypto'
            contentId: contentId || null,
            contentType: contentType || null, // 'reel', 'call', 'conference'
            status: 'pending',
            transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('payments').insertOne(payment);
        // In a real implementation, you would integrate with payment processors here
        // For demo purposes, we'll simulate payment processing
        setTimeout(async () => {
            try {
                // Simulate payment success
                await db.collection('payments').updateOne({ _id: result.insertedId }, {
                    $set: {
                        status: 'completed',
                        completedAt: new Date(),
                        updatedAt: new Date()
                    }
                });
                // Update recipient's earnings
                await db.collection('users').updateOne({ _id: new mongodb_2.ObjectId(recipientId) }, {
                    $inc: {
                        'creatorStats.totalEarnings': amount,
                        'creatorStats.monthlyEarnings': amount
                    }
                });
            }
            catch (error) {
                console.error('Payment processing error:', error);
            }
        }, 2000);
        return Response.json({
            paymentId: result.insertedId.toString(),
            transactionId: payment.transactionId,
            status: 'pending',
            message: 'Payment initiated successfully',
        });
    }
    catch (error) {
        console.error('Payment error:', error);
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
        const type = url.searchParams.get('type'); // 'sent' or 'received'
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const db = await (0, mongodb_1.getDatabase)();
        let query = {};
        if (type === 'sent') {
            query.payerId = user.id;
        }
        else if (type === 'received') {
            query.recipientId = user.id;
        }
        else {
            query = {
                $or: [
                    { payerId: user.id },
                    { recipientId: user.id }
                ]
            };
        }
        const payments = await db.collection('payments')
            .find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        // Populate user details
        const populatedPayments = await Promise.all(payments.map(async (payment) => {
            const payer = await db.collection('users')
                .findOne({ _id: new mongodb_2.ObjectId(payment.payerId) }, { projection: { displayName: 1, avatar: 1, username: 1 } });
            const recipient = await db.collection('users')
                .findOne({ _id: new mongodb_2.ObjectId(payment.recipientId) }, { projection: { displayName: 1, avatar: 1, username: 1 } });
            return {
                id: payment._id.toString(),
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                transactionId: payment.transactionId,
                payer: {
                    id: payment.payerId,
                    name: payer?.displayName || 'Unknown',
                    avatar: payer?.avatar || '',
                    username: payer?.username || '',
                },
                recipient: {
                    id: payment.recipientId,
                    name: recipient?.displayName || 'Unknown',
                    avatar: recipient?.avatar || '',
                    username: recipient?.username || '',
                },
                contentId: payment.contentId,
                contentType: payment.contentType,
                createdAt: payment.createdAt,
                completedAt: payment.completedAt,
            };
        }));
        return Response.json({
            payments: populatedPayments,
            hasMore: payments.length === limit
        });
    }
    catch (error) {
        console.error('Get payments error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
