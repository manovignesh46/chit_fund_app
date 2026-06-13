import prisma from './prisma';

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
      select: { id: true, dataOwnerId: true },
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

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
      })),
    });
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
