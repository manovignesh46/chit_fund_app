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
    const otherAdmins = await prisma.user.findMany({
      where: {
        role: 'admin',
        id: { not: params.actorId },
      },
      select: { id: true },
    });

    if (otherAdmins.length === 0) {
      return;
    }

    await prisma.notification.createMany({
      data: otherAdmins.map((admin) => ({
        userId: admin.id,
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
