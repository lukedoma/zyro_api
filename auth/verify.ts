import { getDatabase } from '../lib/mongodb';

export async function POST(request: Request) {
  try {
    const { method, identifier, code } = await request.json();
    if (!method || !identifier || !code) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = await getDatabase();

    const query = method === 'phone' ? { phone_number: identifier } : { email: identifier };
    const user = await db.collection('users').findOne(query);

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.verification_code || user.verification_code !== code) {
      return Response.json({ error: 'Invalid code' }, { status: 400 });
    }

    if (user.verification_expiresAt && new Date(user.verification_expiresAt).getTime() < Date.now()) {
      return Response.json({ error: 'Code expired' }, { status: 400 });
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { isVerified: true }, $unset: { verification_code: '', verification_expiresAt: '' } }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Verify error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
