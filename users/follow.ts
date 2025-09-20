import { getDatabase } from '../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (userId === user.id) {
      return Response.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Check if user exists
    const targetUser = await db.collection('users')
      .findOne({ _id: new ObjectId(userId) });
    
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already following
    const existingFollow = await db.collection('follows')
      .findOne({
        followerId: user.id,
        followingId: userId
      });

    if (existingFollow) {
      return Response.json(
        { error: 'Already following this user' },
        { status: 400 }
      );
    }

    // Create follow relationship
    const follow = {
      followerId: user.id,
      followingId: userId,
      createdAt: new Date(),
    };

    await db.collection('follows').insertOne(follow);

    // Update follower and following counts
    await Promise.all([
      db.collection('users').updateOne(
        { _id: new ObjectId(user.id) },
        { $inc: { following: 1 } }
      ),
      db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { followers: 1 } }
      )
    ]);

    return Response.json({
      message: 'Successfully followed user',
      isFollowing: true
    });
  } catch (error) {
    console.error('Follow user error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Remove follow relationship
    const result = await db.collection('follows').deleteOne({
      followerId: user.id,
      followingId: userId
    });

    if (result.deletedCount === 0) {
      return Response.json(
        { error: 'Not following this user' },
        { status: 400 }
      );
    }

    // Update follower and following counts
    await Promise.all([
      db.collection('users').updateOne(
        { _id: new ObjectId(user.id) },
        { $inc: { following: -1 } }
      ),
      db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { followers: -1 } }
      )
    ]);

    return Response.json({
      message: 'Successfully unfollowed user',
      isFollowing: false
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const type = url.searchParams.get('type') || 'following'; // 'following' or 'followers'
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const targetUserId = userId || user.id;
    const db = await getDatabase();
    
    let query: any;
    let userField: string;
    
    if (type === 'followers') {
      query = { followingId: targetUserId };
      userField = 'followerId';
    } else {
      query = { followerId: targetUserId };
      userField = 'followingId';
    }

    const follows = await db.collection('follows')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get user details for each follow
    const users = await Promise.all(
      follows.map(async (follow) => {
        const userId = follow[userField];
        const userDoc = await db.collection('users')
          .findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0, privateKey: 0 } }
          );

        if (!userDoc) return null;

        // Check if current user is following this user
        const isFollowing = await db.collection('follows')
          .findOne({
            followerId: user.id,
            followingId: userId
          });

        return {
          id: userDoc._id.toString(),
          username: userDoc.username,
          displayName: userDoc.displayName,
          avatar: userDoc.avatar,
          isVerified: userDoc.isVerified || false,
          isCreator: userDoc.isCreator || false,
          followers: userDoc.followers || 0,
          following: userDoc.following || 0,
          isFollowing: !!isFollowing,
        };
      })
    );

    const filteredUsers = users.filter(user => user !== null);

    return Response.json({
      users: filteredUsers,
      hasMore: follows.length === limit
    });
  } catch (error) {
    console.error('Get follows error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}