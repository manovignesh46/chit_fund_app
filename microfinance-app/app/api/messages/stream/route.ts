import { NextRequest } from 'next/server';
import { getCurrentUserId, getActorUserId } from '../../../../lib/auth';
import { getUnreadMessageCount } from '../../../../lib/messages';
import {
  registerMessageClient,
  unregisterMessageClient,
} from '../../../../lib/messageStream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const actorId = await getActorUserId(request);
  const dataOwnerId = await getCurrentUserId(request);
  if (!actorId || !dataOwnerId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = crypto.randomUUID();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      registerMessageClient(actorId, { id: clientId, send });

      const unreadCount = await getUnreadMessageCount(dataOwnerId, actorId);
      send(`event: connected\ndata: ${JSON.stringify({ unreadCount })}\n\n`);

      heartbeat = setInterval(() => {
        send(': ping\n\n');
      }, 25000);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unregisterMessageClient(actorId, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
