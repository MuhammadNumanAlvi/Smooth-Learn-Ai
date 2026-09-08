import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../app';

type ExpressApp = (req: IncomingMessage, res: ServerResponse) => void;

let appPromise: Promise<ExpressApp> | null = null;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function pathOf(req: IncomingMessage): string {
  return String(req.url || '').split('?')[0];
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function isHealth(pathname: string): boolean {
  return pathname === '/api/health' || pathname === '/health';
}

function isRegister(pathname: string): boolean {
  return pathname === '/api/documents/register' || pathname === '/documents/register';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const pathname = pathOf(req);

  try {
    if (isHealth(pathname)) {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'Smooth Learn',
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'POST' && isRegister(pathname)) {
      const body = await readJsonBody(req);
      const fileName = String(body.fileName || 'document.pdf');
      const rawId = String(body.id || '').trim();
      const id = /^[a-zA-Z0-9_-]+$/.test(rawId)
        ? rawId
        : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const chapters = Array.isArray(body.chapters) && body.chapters.length
        ? body.chapters
        : [{ id: 'ch-full', title: 'Full book', summary: '', keyPoints: [], estimatedReadTime: '30 min' }];
      return sendJson(res, 200, {
        success: true,
        data: {
          id,
          userId: body.userId || 'default-user',
          title: String(body.title || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')),
          fileName,
          fileSize: String(body.fileSize || ''),
          uploadDate: new Date().toISOString(),
          pageCount: Number(body.pageCount) || 0,
          summary: String(body.summary || 'Book uploaded. Open a chapter to practise.'),
          extractedContent: '',
          chapters,
          keyTerms: [],
          overallDifficulty: 'Intermediate',
          totalQuizzesGenerated: 0,
          processingStatus: 'ready',
          progress: 100,
        },
      });
    }

    if (!appPromise) {
      appPromise = createApp().then((app) => app as unknown as ExpressApp);
    }
    const app = await appPromise;
    app(req, res);
  } catch (err: any) {
    const message = err?.message || String(err || 'API boot failed');
    console.error('[Smooth Learn API]', message);
    sendJson(res, 500, { success: false, error: message });
  }
}
