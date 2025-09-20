import { getDatabase } from '../lib/mongodb';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

export async function POST(request: Request) {
  try {
    const { method, identifier } = await request.json();
    if (!method || !identifier) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = await getDatabase();
    const query = method === 'phone' ? { phone_number: identifier } : { email: identifier };
    const user = await db.collection('users').findOne(query);

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const newCode = method === 'phone' ? Math.floor(100000 + Math.random() * 900000).toString() : crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { verification_code: newCode, verification_expiresAt: expiresAt } }
    );

    try {
      if (method === 'phone') {
        const twilioEnvSet = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM;
        if (twilioEnvSet) {
          const twilioMod: any = await import('twilio');
          const twilioFn: any = (twilioMod && twilioMod.default) ? twilioMod.default : twilioMod;
          const client = twilioFn(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            from: process.env.TWILIO_FROM,
            to: identifier,
            body: `Your verification code is ${newCode}`,
          });
        } else {
          console.warn('Twilio env not set; skipping SMS send');
        }
      } else {
        const origin = request.headers.get('origin') ?? process.env.PUBLIC_BASE_URL ?? '';
        const verificationLink = `${origin}/verify?method=email&code=${newCode}&email=${encodeURIComponent(identifier)}`;
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          await sgMail.send({
            to: identifier,
            from: process.env.SENDGRID_FROM,
            subject: 'Verify your account',
            html: `<p>Click to verify: <a href="${verificationLink}">${verificationLink}</a></p>`
          });
        } else {
          console.warn('SENDGRID env not set; skipping email send');
        }
      }
    } catch (notifyErr) {
      console.error('Notification error:', notifyErr);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
