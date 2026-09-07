import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server';

type ExpressApp = Awaited<ReturnType<typeof createApp>>;

let appPromise: Promise<ExpressApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  app(req as any, res as any);
}
