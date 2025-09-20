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
    
    // Get user's chats
    const chats = await db.collection('chats')
      .find({ participants: user.id })
      .sort({ lastMessageAt: -1 })
      .toArray();

    // Populate participant details and last message
    const populatedChats = await Promise.all(
      chats.map(async (chat) => {
        // Get other participants
        const otherParticipantIds = chat.participants.filter((id: string) => id !== user.id);
        const participants = await db.collection('users')
          .find({ _id: { $in: otherParticipantIds.map((id: string) => new ObjectId(id)) } })
          .project({ password: 0, privateKey: 0 })
          .toArray();

        // Get last message
        const lastMessage = await db.collection('messages')
          .findOne(
            { chatId: chat._id.toString() },
            { sort: { createdAt: -1 } }
          );

        // Get unread count
        const unreadCount = await db.collection('messages')
          .countDocuments({
            chatId: chat._id.toString(),
            senderId: { $ne: user.id },
            readBy: { $ne: user.id }
          });

        return {
          id: chat._id.toString(),
          name: chat.isGroup ? chat.name : participants[0]?.displayName || 'Unknown',
          avatar: chat.isGroup ? chat.avatar : participants[0]?.avatar || '',
          lastMessage: lastMessage?.content || '',
          timestamp: lastMessage?.createdAt || chat.createdAt,
          unreadCount,
          isEncrypted: chat.isEncrypted || false,
          isGroup: chat.isGroup || false,
          participants: participants.map((p: any) => ({
            id: p._id.toString(),
            name: p.displayName,
            avatar: p.avatar,
            username: p.username,
          })),
        };
      })
    );

    return Response.json({ chats: populatedChats });
  } catch (error) {
    console.error('Get chats error:', error);
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

    const { participantIds, isGroup, name, isEncrypted } = await request.json();

    if (!participantIds || participantIds.length === 0) {
      return Response.json(
        { error: 'Participant IDs are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Create new chat
    const chat = {
      participants: [user.id, ...participantIds],
      isGroup: isGroup || false,
      name: name || null,
      avatar: isGroup ? `https://api.dicebear.com/7.x/shapes/svg?seed=${Date.now()}` : null,
      isEncrypted: isEncrypted || true,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };

    const result = await db.collection('chats').insertOne(chat);

    return Response.json({
      chatId: result.insertedId.toString(),
      message: 'Chat created successfully',
    });
  } catch (error) {
    console.error('Create chat error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}