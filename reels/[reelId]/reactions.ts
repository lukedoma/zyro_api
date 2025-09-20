import { getDatabase } from '@/api/lib/mongodb';
import { getUserFromToken, getAuthHeader } from '@/api/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    if (!request || !request.url) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const url = new URL(request.url);
    const reelId = url.pathname.split('/')[3]; // Extract reelId from path

    if (!reelId || reelId.trim().length === 0) {
      return Response.json({ error: 'Invalid reel ID' }, { status: 400 });
    }

    const db = await getDatabase();
    
    // Get reactions for the reel
    const reactions = await db.collection('reactions')
      .find({ contentId: reelId, contentType: 'reel' })
      .toArray();

    // Count reactions by type
    const reactionCounts = reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Response.json({ reactions: reactionCounts });
  } catch (error) {
    console.error('Get reactions error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!request || !request.url) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const url = new URL(request.url);
    const reelId = url.pathname.split('/')[3]; // Extract reelId from path

    if (!reelId || reelId.trim().length === 0) {
      return Response.json({ error: 'Invalid reel ID' }, { status: 400 });
    }

    if (!request.headers) {
      return Response.json({ error: 'Invalid request headers' }, { status: 400 });
    }

    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (!type || typeof type !== 'string' || type.trim().length === 0) {
      return Response.json({ error: 'Reaction type is required' }, { status: 400 });
    }

    if (!['like', 'love', 'laugh', 'wow', 'sad', 'angry'].includes(type)) {
      return Response.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Check if reel exists
    const reel = await db.collection('reels').findOne({ _id: new ObjectId(reelId) });
    if (!reel) {
      return Response.json({ error: 'Reel not found' }, { status: 404 });
    }

    // Check if user already reacted to this reel
    const existingReaction = await db.collection('reactions').findOne({
      userId: user.id,
      contentId: reelId,
      contentType: 'reel'
    });

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Remove reaction
        await db.collection('reactions').deleteOne({ _id: existingReaction._id });
        await db.collection('reels').updateOne(
          { _id: new ObjectId(reelId) },
          { $inc: { likes: -1 } }
        );
        return Response.json({ 
          reacted: false,
          type: null,
          message: 'Reaction removed successfully' 
        });
      } else {
        // Update reaction type
        await db.collection('reactions').updateOne(
          { _id: existingReaction._id },
          { $set: { type, createdAt: new Date() } }
        );
        return Response.json({ 
          reacted: true,
          type,
          message: 'Reaction updated successfully' 
        });
      }
    } else {
      // Add new reaction
      await db.collection('reactions').insertOne({
        userId: user.id,
        contentId: reelId,
        contentType: 'reel',
        type,
        createdAt: new Date()
      });
      
      await db.collection('reels').updateOne(
        { _id: new ObjectId(reelId) },
        { $inc: { likes: 1 } }
      );
      
      return Response.json({ 
        reacted: true,
        type,
        message: 'Reaction added successfully' 
      });
    }
  } catch (error) {
    console.error('Reaction error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}