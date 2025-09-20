import { getDatabase } from '../lib/mongodb';
import { hashPassword } from '../lib/auth';
import { generateKeyPair } from '../lib/encryption';

export async function POST(request: Request) {
  try {
    const { countryCode, phoneNumber, name, password } = await request.json();

    if (!countryCode || !phoneNumber) {
      return Response.json({ error: 'Country code and phone number are required' }, { status: 400 });
    }

    const db = await getDatabase();

    const existingUser = await db.collection('users').findOne({ phone_number: phoneNumber });
    if (existingUser) {
      return Response.json({ error: 'User already exists with this phone number' }, { status: 409 });
    }

    const username = `user${Math.random().toString(36).slice(2, 8)}`;

    let hashedPassword: string | null = null;
    if (password && typeof password === 'string' && password.length >= 6) {
      hashedPassword = await hashPassword(password);
    }

    const { publicKey, privateKey } = generateKeyPair();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

    const user = {
      phone_number: phoneNumber,
      country_code: countryCode,
      email: null,
      username,
      displayName: name ?? username,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isVerified: false,
      isCreator: false,
      followers: 0,
      following: 0,
      publicKey,
      privateKey,
      verification_code: otp,
      verification_expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;

    const result = await db.collection('users').insertOne(user);

    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
        const twilioMod: any = await import('twilio');
        const twilioFn: any = (twilioMod && twilioMod.default) ? twilioMod.default : twilioMod;
        const client = twilioFn(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          from: process.env.TWILIO_FROM,
          to: phoneNumber,
          body: `Your verification code is ${otp}`,
        });
      } else {
        console.warn('Twilio env not set; skipping SMS send');
      }
    } catch (smsErr) {
      console.error('Twilio SMS error:', smsErr);
    }

    return Response.json({ success: true, userId: result.insertedId.toString(), phoneNumber });
  } catch (error) {
    console.error('Phone registration error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
