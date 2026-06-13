type SSEClient = {
  id: string;
  send: (chunk: string) => void;
};

// Persist across hot reloads in dev
const globalForSSE = globalThis as typeof globalThis & {
  __notificationSSEClients?: Map<number, Set<SSEClient>>;
};

const clientsByUser =
  globalForSSE.__notificationSSEClients ?? new Map<number, Set<SSEClient>>();
globalForSSE.__notificationSSEClients = clientsByUser;

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function registerNotificationClient(userId: number, client: SSEClient): void {
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  clientsByUser.get(userId)!.add(client);
}

export function unregisterNotificationClient(userId: number, clientId: string): void {
  const clients = clientsByUser.get(userId);
  if (!clients) return;

  for (const client of clients) {
    if (client.id === clientId) {
      clients.delete(client);
      break;
    }
  }

  if (clients.size === 0) {
    clientsByUser.delete(userId);
  }
}

export function pushNotificationEvent(
  userId: number,
  event: 'notification' | 'unread_count',
  data: unknown
): void {
  const clients = clientsByUser.get(userId);
  if (!clients?.size) return;

  const payload = formatSSE(event, data);
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function pushToUsers(
  userIds: number[],
  event: 'notification' | 'unread_count',
  data: unknown
): void {
  for (const userId of userIds) {
    pushNotificationEvent(userId, event, data);
  }
}
