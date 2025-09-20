import { getDatabase } from '../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../lib/auth';

export async function GET(request: Request) {
  try {
    if (!request) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDatabase();
    const adminUser = await db.collection('admins').findOne({ userId: user.id });
    if (!adminUser) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'ads';

    if (type === 'ads') {
      const analytics = await db.collection('ad_analytics').aggregate([
        {
          $group: {
            _id: '$adId',
            impressions: { $sum: { $cond: [{ $eq: ['$action', 'view'] }, 1, 0] } },
            clicks: { $sum: { $cond: [{ $eq: ['$action', 'click'] }, 1, 0] } },
            lastActivity: { $max: '$timestamp' }
          }
        }
      ]).toArray();

      return Response.json({ analytics });
    } else if (type === 'users') {
      const userStats = await db.collection('user_activities').aggregate([
        {
          $group: {
            _id: '$userId',
            activities: { $sum: 1 },
            lastActivity: { $max: '$timestamp' }
          }
        },
        { $sort: { activities: -1 } },
        { $limit: 50 }
      ]).toArray();

      return Response.json({ userStats });
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Get analytics error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}