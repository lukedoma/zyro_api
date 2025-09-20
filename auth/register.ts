import { getDatabase } from '../lib/mongodb';
import { hashPassword } from '../lib/auth';
import { generateKeyPair } from '../lib/encryption';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();

    if (!fullName || !email || !password) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return Response.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    const username = email.split('@')[0].toLowerCase() + Math.random().toString(36).substring(2, 6);

    const hashedPassword = await hashPassword(password);

    const { publicKey, privateKey } = generateKeyPair();

    const verificationCode = crypto.randomUUID();
    const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

    const user = {
      email,
      username,
      displayName: fullName,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isVerified: false,
      isCreator: false,
      followers: 0,
      following: 0,
      publicKey,
      privateKey,
      verification_code: verificationCode,
      verification_expiresAt: verificationExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;

    const result = await db.collection('users').insertOne(user);

    const origin = request.headers.get('origin') ?? process.env.PUBLIC_BASE_URL ?? '';
    const verificationLink = `${origin}/verify?method=email&code=${verificationCode}&email=${encodeURIComponent(email)}`;

    console.log('DEV email verification link:', verificationLink);

    try {
      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM,
          subject: 'Verify your account',
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height:1.6;">
            <h2>Welcome, ${fullName}!</h2>
            <p>Thanks for signing up. Please verify your email to activate your account.</p>
            <p><a href="${verificationLink}" style="display:inline-block;padding:12px 18px;background:#0ea5e9;color:#fff;border-radius:10px;text-decoration:none;">Verify Email</a></p>
            <p>Or copy this link: <br/><a href="${verificationLink}">${verificationLink}</a></p>
          </div>`
        });
      } else {
        console.warn('SENDGRID env not set; skipping email send');
      }
    } catch (mailErr) {
      console.error('SendGrid error:', mailErr);
    }

    return Response.json({
      message: 'Verification email sent. Please check your inbox to verify your account.',
      dev: { code: verificationCode, link: verificationLink },
      userId: result.insertedId.toString(),
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}