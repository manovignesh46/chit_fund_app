import prisma from './prisma';
import { pushNotificationEvent } from './notificationStream';

export interface NotifyParams {
  actorId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function notifyOtherAdmins(params: NotifyParams): Promise<void> {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: params.actorId },
      select: { id: true, dataOwnerId: true, name: true },
    });

    if (!actor) return;

    const orgOwnerId = actor.dataOwnerId ?? actor.id;

    const recipients = await prisma.user.findMany({
      where: {
        id: { not: params.actorId },
        role: { in: ['admin', 'partner'] },
        OR: [
          { id: orgOwnerId },
          { dataOwnerId: orgOwnerId },
        ],
      },
      select: { id: true },
    });

    if (recipients.length === 0) {
      return;
    }

    const createdNotifications = await Promise.all(
      recipients.map((recipient) =>
        prisma.notification.create({
          data: {
            userId: recipient.id,
            actorId: params.actorId,
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link ?? null,
          },
          include: {
            actor: {
              select: { id: true, name: true },
            },
          },
        })
      )
    );

    for (const notification of createdNotifications) {
      const unreadCount = await prisma.notification.count({
        where: { userId: notification.userId, read: false },
      });

      pushNotificationEvent(notification.userId, 'notification', {
        notification,
        unreadCount,
      });
    }
  } catch (error) {
    console.error('Failed to create notifications:', error);
  }
}

export async function getActorName(actorId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });
  return user?.name ?? 'Someone';
}
