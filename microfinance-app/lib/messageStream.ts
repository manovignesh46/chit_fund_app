type SSEClient = {
  id: string;
  send: (chunk: string) => void;
};

const globalForSSE = globalThis as typeof globalThis & {
  __messageSSEClients?: Map<number, Set<SSEClient>>;
};

const clientsByUser =
  globalForSSE.__messageSSEClients ?? new Map<number, Set<SSEClient>>();
globalForSSE.__messageSSEClients = clientsByUser;

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function registerMessageClient(userId: number, client: SSEClient): void {
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  clientsByUser.get(userId)!.add(client);
}

export function unregisterMessageClient(userId: number, clientId: string): void {
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

export function pushMessageEvent(
  userId: number,
  event: 'chat_message' | 'unread_count',
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

export function pushMessageToUsers(
  userIds: number[],
  event: 'chat_message' | 'unread_count',
  data: unknown
): void {
  for (const userId of userIds) {
    pushMessageEvent(userId, event, data);
  }
}
