"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        const { method, identifier } = await request.json();
        if (!method || !identifier) {
            return Response.json({ error: 'Missing fields' }, { status: 400 });
        }
        const db = await (0, mongodb_1.getDatabase)();
        const query = method === 'phone' ? { phone_number: identifier } : { email: identifier };
        const user = await db.collection('users').findOne(query);
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }
        const newCode = method === 'phone' ? Math.floor(100000 + Math.random() * 900000).toString() : crypto_1.default.randomUUID();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { verification_code: newCode, verification_expiresAt: expiresAt } });
        try {
            if (method === 'phone') {
                const twilioEnvSet = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM;
                if (twilioEnvSet) {
                    const twilioMod = await Promise.resolve().then(() => __importStar(require('twilio')));
                    const twilioFn = (twilioMod && twilioMod.default) ? twilioMod.default : twilioMod;
                    const client = twilioFn(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                    await client.messages.create({
                        from: process.env.TWILIO_FROM,
                        to: identifier,
                        body: `Your verification code is ${newCode}`,
                    });
                }
                else {
                    console.warn('Twilio env not set; skipping SMS send');
                }
            }
            else {
                const origin = request.headers.get('origin') ?? process.env.PUBLIC_BASE_URL ?? '';
                const verificationLink = `${origin}/verify?method=email&code=${newCode}&email=${encodeURIComponent(identifier)}`;
                if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
                    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
                    await mail_1.default.send({
                        to: identifier,
                        from: process.env.SENDGRID_FROM,
                        subject: 'Verify your account',
                        html: `<p>Click to verify: <a href="${verificationLink}">${verificationLink}</a></p>`
                    });
                }
                else {
                    console.warn('SENDGRID env not set; skipping email send');
                }
            }
        }
        catch (notifyErr) {
            console.error('Notification error:', notifyErr);
        }
        return Response.json({ success: true });
    }
    catch (error) {
        console.error('Resend error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
