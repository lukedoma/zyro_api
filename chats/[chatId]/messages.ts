import { getDatabase } from '../../lib/mongodb';
import { getUserFromToken, getAuthHeader } from '../../lib/auth';
import { encryptMessage, decryptMessage } from '../../lib/encryption';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chatId = url.pathname.split('/')[3]; // Extract chatId from path
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDatabase();
    
    // Verify user is participant in chat
    const chat = await db.collection('chats').findOne({
      _id: new ObjectId(chatId),
      participants: user.id
    });

    if (!chat) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get messages with pagination
    const messages = await db.collection('messages')
      .find({ chatId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Populate sender details and decrypt if needed
    const populatedMessages = await Promise.all(
      messages.map(async (message) => {
        const sender = await db.collection('users')
          .findOne(
            { _id: new ObjectId(message.senderId) },
            { projection: { displayName: 1, avatar: 1, username: 1 } }
          );

        let content = message.content;
        
        // Decrypt message if encrypted
        if (message.isEncrypted && message.encryptionData) {
          try {
            content = decryptMessage(
              message.encryptionData.encrypted,
              message.encryptionData.iv,
              message.encryptionData.tag
            );
          } catch (error) {
            console.error('Decryption error:', error);
            content = '[Encrypted message - unable to decrypt]';
          }
        }

        return {
          id: message._id.toString(),
          chatId: message.chatId,
          senderId: message.senderId,
          sender: {
            id: message.senderId,
            name: sender?.displayName || 'Unknown',
            avatar: sender?.avatar || '',
            username: sender?.username || '',
          },
          content,
          timestamp: message.createdAt,
          type: message.type || 'text',
          isEncrypted: message.isEncrypted || false,
        };
      })
    );

    // Mark messages as read
    await db.collection('messages').updateMany(
      {
        chatId,
        senderId: { $ne: user.id },
        readBy: { $ne: user.id }
      },
      {
        // $addToSet: { readBy: user.id }
        $addToSet: { readBy: { $each: [user.id] } }
      }
    );

    return Response.json({ 
      messages: populatedMessages.reverse(), // Return in chronological order
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const chatId = url.pathname.split('/')[3]; // Extract chatId from path

    const token = getAuthHeader(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { content, type = 'text' } = await request.json();

    if (!content) {
      return Response.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Verify user is participant in chat
    const chat = await db.collection('chats').findOne({
      _id: new ObjectId(chatId),
      participants: user.id
    });

    if (!chat) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Encrypt message if chat is encrypted
    let messageData: any = {
      chatId,
      senderId: user.id,
      content,
      type,
      isEncrypted: chat.isEncrypted || false,
      readBy: [user.id],
      createdAt: new Date(),
    };

    if (chat.isEncrypted) {
      const encryptionData = encryptMessage(content);
      messageData.encryptionData = encryptionData;
      messageData.content = '[Encrypted]'; // Store placeholder
    }

    const result = await db.collection('messages').insertOne(messageData);

    // Update chat's last message timestamp
    await db.collection('chats').updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { lastMessageAt: new Date() } }
    );

    return Response.json({
      messageId: result.insertedId.toString(),
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Send message error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}