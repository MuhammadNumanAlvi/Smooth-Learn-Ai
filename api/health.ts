export default function handler(
  _req: { url?: string },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body: string) => void }
) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      status: 'ok',
      service: 'Smooth Learn',
      timestamp: new Date().toISOString(),
    })
  );
}
