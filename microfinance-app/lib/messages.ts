import prisma from './prisma';

export async function getOrgMemberIds(dataOwnerId: number): Promise<number[]> {
  const members = await prisma.user.findMany({
    where: {
      OR: [{ id: dataOwnerId }, { dataOwnerId }],
    },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

export async function getOrgMembers(dataOwnerId: number) {
  return prisma.user.findMany({
    where: {
      OR: [{ id: dataOwnerId }, { dataOwnerId }],
    },
    select: {
      id: true,
      name: true,
      role: true,
      partner: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getUnreadMessageCount(
  dataOwnerId: number,
  userId: number
): Promise<number> {
  const readState = await prisma.messageReadState.findUnique({
    where: { userId_dataOwnerId: { userId, dataOwnerId } },
  });
  const lastReadAt = readState?.lastReadAt ?? new Date(0);

  return prisma.message.count({
    where: {
      dataOwnerId,
      senderId: { not: userId },
      createdAt: { gt: lastReadAt },
    },
  });
}

export async function markMessagesRead(dataOwnerId: number, userId: number) {
  await prisma.messageReadState.upsert({
    where: { userId_dataOwnerId: { userId, dataOwnerId } },
    create: { userId, dataOwnerId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

export async function broadcastNewMessage(
  dataOwnerId: number,
  message: {
    id: number;
    content: string;
    createdAt: Date;
    sender: {
      id: number;
      name: string;
      role: string;
      partner: { id: number; name: string } | null;
    };
  }
) {
  const { pushMessageEvent } = await import('./messageStream');
  const memberIds = await getOrgMemberIds(dataOwnerId);

  for (const userId of memberIds) {
    const unreadCount = await getUnreadMessageCount(dataOwnerId, userId);
    pushMessageEvent(userId, 'chat_message', { message, unreadCount });
  }
}

export async function broadcastMessageUnreadCount(dataOwnerId: number, userId: number) {
  const { pushMessageEvent } = await import('./messageStream');
  const unreadCount = await getUnreadMessageCount(dataOwnerId, userId);
  pushMessageEvent(userId, 'unread_count', { unreadCount });
}

