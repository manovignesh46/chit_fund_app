import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId, getActorUserId } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getActorUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '20'),
      50
    );
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const usePagination = searchParams.has('page');

    const where = {
      userId: currentUserId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const skip = usePagination ? (page - 1) * pageSize : 0;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          actor: {
            select: { id: true, name: true },
          },
        },
      }),
      usePagination
        ? prisma.notification.count({ where })
        : Promise.resolve(0),
      prisma.notification.count({
        where: { userId: currentUserId, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      ...(usePagination && {
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      }),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUserId = await getActorUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: currentUserId, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification id is required' }, { status: 400 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id: parseInt(id), userId: currentUserId },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
