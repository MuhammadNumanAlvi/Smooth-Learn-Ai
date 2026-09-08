import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
/** Keep JSON under Vercel's ~4.5MB function body limit. */
export const MAX_TEXT_CHARS = 3_200_000;

export async function extractPdfText(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ text: string; pageCount: number }> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({
    data: new Uint8Array(data),
    disableRange: true,
    disableStream: true,
  }).promise;

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) parts.push(line);
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }

  let text = parts.join('\n\n').trim();
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
  }
  return { text, pageCount: pdf.numPages };
}
