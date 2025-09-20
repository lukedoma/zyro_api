import { getDatabase } from '../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const isLive = url.searchParams.get('isLive') === 'true';

    const db = await getDatabase();
    
    let query: any = {};
    if (isLive) {
      query.isLive = true;
    }

    // Get conferences with pagination
    const conferences = await db.collection('conferences')
      .find(query)
      .sort({ scheduledTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Populate host details
    const populatedConferences = await Promise.all(
      conferences.map(async (conference) => {
        const host = await db.collection('users')
          .findOne(
            { _id: new ObjectId(conference.hostId) },
            { projection: { displayName: 1, avatar: 1, username: 1 } }
          );

        return {
          id: conference._id.toString(),
          title: conference.title,
          description: conference.description,
          hostId: conference.hostId,
          host: {
            username: host?.username || 'unknown',
            displayName: host?.displayName || 'Unknown',
            avatar: host?.avatar || '',
          },
          scheduledTime: conference.scheduledTime,
          duration: conference.duration,
          maxParticipants: conference.maxParticipants,
          currentParticipants: conference.currentParticipants || 0,
          isPaid: conference.isPaid || false,
          price: conference.price,
          tags: conference.tags || [],
          isLive: conference.isLive || false,
        };
      })
    );

    return Response.json({ 
      conferences: populatedConferences,
      hasMore: conferences.length === limit
    });
  } catch (error) {
    console.error('Get conferences error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const { 
      title, 
      description, 
      scheduledTime, 
      duration, 
      maxParticipants, 
      isPaid, 
      price, 
      tags 
    } = await request.json();

    if (!title || !scheduledTime || !duration) {
      return Response.json(
        { error: 'Title, scheduled time, and duration are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Create new conference
    const conference = {
      title,
      description: description || '',
      hostId: user.id,
      scheduledTime: new Date(scheduledTime),
      duration,
      maxParticipants: maxParticipants || 100,
      currentParticipants: 0,
      isPaid: isPaid || false,
      price: isPaid ? price : null,
      tags: tags || [],
      isLive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('conferences').insertOne(conference);

    return Response.json({
      conferenceId: result.insertedId.toString(),
      message: 'Conference created successfully',
    });
  } catch (error) {
    console.error('Create conference error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}