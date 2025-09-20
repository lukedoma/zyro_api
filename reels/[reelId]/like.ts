import { getDatabase } from '../../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reelId = url.pathname.split('/')[3]; // Extract reelId from path

    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDatabase();
    
    // Check if reel exists
    const reel = await db.collection('reels').findOne({ _id: new ObjectId(reelId) });
    if (!reel) {
      return Response.json({ error: 'Reel not found' }, { status: 404 });
    }

    // Check if user already liked this reel
    const existingLike = await db.collection('likes').findOne({
      userId: user.id,
      contentId: reelId,
      contentType: 'reel'
    });

    if (existingLike) {
      // Unlike - remove like and decrement counter
      await db.collection('likes').deleteOne({ _id: existingLike._id });
      await db.collection('reels').updateOne(
        { _id: new ObjectId(reelId) },
        { $inc: { likes: -1 } }
      );
      
      return Response.json({ 
        liked: false,
        message: 'Reel unliked successfully' 
      });
    } else {
      // Like - add like and increment counter
      await db.collection('likes').insertOne({
        userId: user.id,
        contentId: reelId,
        contentType: 'reel',
        createdAt: new Date()
      });
      
      await db.collection('reels').updateOne(
        { _id: new ObjectId(reelId) },
        { $inc: { likes: 1 } }
      );
      
      return Response.json({ 
        liked: true,
        message: 'Reel liked successfully' 
      });
    }
  } catch (error) {
    console.error('Like reel error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}