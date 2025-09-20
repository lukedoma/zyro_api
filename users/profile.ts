import { getDatabase } from '../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDatabase();
    
    // Get full user profile
    const userProfile = await db.collection('users')
      .findOne(
        { _id: new ObjectId(user.id) },
        { projection: { password: 0, privateKey: 0 } }
      );

    if (!userProfile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Get creator stats if user is a creator
    let creatorStats = null;
    if (userProfile.isCreator) {
      const stats = await db.collection('payments')
        .aggregate([
          {
            $match: {
              recipientId: user.id,
              status: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              totalEarnings: { $sum: '$amount' },
              monthlyEarnings: {
                $sum: {
                  $cond: [
                    {
                      $gte: [
                        '$completedAt',
                        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                      ]
                    },
                    '$amount',
                    0
                  ]
                }
              }
            }
          }
        ])
        .toArray();

      const reelViews = await db.collection('reels')
        .aggregate([
          { $match: { creatorId: user.id } },
          { $group: { _id: null, totalViews: { $sum: '$views' } } }
        ])
        .toArray();

      const subscribers = await db.collection('follows')
        .countDocuments({ followingId: user.id });

      creatorStats = {
        totalEarnings: stats[0]?.totalEarnings || 0,
        monthlyEarnings: stats[0]?.monthlyEarnings || 0,
        contentViews: reelViews[0]?.totalViews || 0,
        rating: 4.8, // This would be calculated from reviews
        subscribers,
      };
    }

    return Response.json({
      user: {
        id: userProfile._id.toString(),
        username: userProfile.username,
        displayName: userProfile.displayName,
        email: userProfile.email,
        avatar: userProfile.avatar,
        isVerified: userProfile.isVerified || false,
        isCreator: userProfile.isCreator || false,
        followers: userProfile.followers || 0,
        following: userProfile.following || 0,
        createdAt: userProfile.createdAt,
      },
      creatorStats,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { displayName, avatar, isCreator } = await request.json();

    const db = await getDatabase();
    
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (displayName) updateData.displayName = displayName;
    if (avatar) updateData.avatar = avatar;
    if (typeof isCreator === 'boolean') updateData.isCreator = isCreator;

    await db.collection('users').updateOne(
      { _id: new ObjectId(user.id) },
      { $set: updateData }
    );

    return Response.json({
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}