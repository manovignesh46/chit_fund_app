import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId, getActorUserId } from '../../../lib/auth';
import {
  getOrgMembers,
  getUnreadMessageCount,
  markMessagesRead,
  broadcastNewMessage,
  broadcastMessageUnreadCount,
} from '../../../lib/messages';

const MAX_CONTENT_LENGTH = 2000;
const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const dataOwnerId = await getCurrentUserId(request);
    const actorId = await getActorUserId(request);
    if (!dataOwnerId || !actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const beforeId = searchParams.get('beforeId');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT)), 100);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const readState = await prisma.messageReadState.findUnique({
      where: { userId_dataOwnerId: { userId: actorId, dataOwnerId } },
    });
    const lastReadAt = readState?.lastReadAt ?? new Date(0);

    const baseWhere: { dataOwnerId: number; createdAt?: { gt?: Date; lt?: never }; id?: { lt: number }; senderId?: { not: number } } = {
      dataOwnerId,
    };

    if (since) {
      baseWhere.createdAt = { gt: new Date(since) };
    } else if (beforeId) {
      baseWhere.id = { lt: parseInt(beforeId) };
    }

    if (unreadOnly && !since && !beforeId) {
      baseWhere.senderId = { not: actorId };
      baseWhere.createdAt = { gt: lastReadAt };
    }

    const where = baseWhere;

    const [messages, unreadCount, participants, totalCount] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: since ? { createdAt: 'asc' } : { createdAt: 'desc' },
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
              partner: { select: { id: true, name: true } },
            },
          },
        },
      }),
      getUnreadMessageCount(dataOwnerId, actorId),
      getOrgMembers(dataOwnerId),
      prisma.message.count({ where: { dataOwnerId } }),
    ]);

    const orderedMessages = since ? messages : [...messages].reverse();

    return NextResponse.json({
      messages: orderedMessages,
      unreadCount,
      participants,
      totalCount,
      hasMore: beforeId ? messages.length === limit : totalCount > limit,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const dataOwnerId = await getCurrentUserId(request);
    const actorId = await getActorUserId(request);
    if (!dataOwnerId || !actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        dataOwnerId,
        senderId: actorId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
            partner: { select: { id: true, name: true } },
          },
        },
      },
    });

    await markMessagesRead(dataOwnerId, actorId);

    await broadcastNewMessage(dataOwnerId, message);

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const dataOwnerId = await getCurrentUserId(request);
    const actorId = await getActorUserId(request);
    if (!dataOwnerId || !actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (body.markRead) {
      await markMessagesRead(dataOwnerId, actorId);
      await broadcastMessageUnreadCount(dataOwnerId, actorId);
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating message state:', error);
    return NextResponse.json({ error: 'Failed to update messages' }, { status: 500 });
  }
}
