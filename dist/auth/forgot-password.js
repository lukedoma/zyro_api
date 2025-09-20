"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const mongodb_1 = require("../lib/mongodb");
const crypto_1 = __importDefault(require("crypto"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
async function POST(request) {
    try {
        const { email } = await request.json();
        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return Response.json({
                message: 'If an account with that email exists, we have sent you a password reset link.',
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000);
        await db.collection('users').updateOne({ _id: user._id }, {
            $set: {
                resetToken,
                resetTokenExpiry,
                updatedAt: new Date(),
            },
        });
        const origin = request.headers.get('origin') ?? process.env.PUBLIC_BASE_URL ?? '';
        const resetLink = `${origin}/reset-password?token=${resetToken}`;
        console.log('DEV reset link:', resetLink);
        try {
            if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
                mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
                await mail_1.default.send({
                    to: email,
                    from: process.env.SENDGRID_FROM,
                    subject: 'Reset your password',
                    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height:1.6;">
            <h2>Password Reset</h2>
            <p>We received a request to reset your password.</p>
            <p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#0ea5e9;color:#fff;border-radius:10px;text-decoration:none;">Reset Password</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>`
                });
            }
            else {
                console.warn('SENDGRID env not set; skipping reset email');
            }
        }
        catch (mailErr) {
            console.error('SendGrid reset email error:', mailErr);
        }
        return Response.json({
            message: 'If an account with that email exists, we have sent you a password reset link.',
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
