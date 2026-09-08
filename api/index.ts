import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server';

type ExpressApp = Awaited<ReturnType<typeof createApp>>;

let appPromise: Promise<ExpressApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    app(req as any, res as any);
  } catch (err: any) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err?.message || 'A server error occurred.' }));
    }
  }
}
