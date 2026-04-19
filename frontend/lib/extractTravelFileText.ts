/** Client-side text extraction for travel uploads (PDF / DOCX / plain text). */

export function extractTextFromPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await getDocument({ data: typedArray }).promise;
        let text = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => ('str' in item ? item.str ?? '' : '')).join(' ') + '\n';
        }
        resolve(text);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function extractTextFromDocx(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer: e.target?.result as ArrayBuffer });
        resolve(result.value);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return extractTextFromPdf(file);
  if (ext === 'docx') return extractTextFromDocx(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function isChatImageFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (/^image\/(png|jpeg|jpg|webp)$/i.test(t)) return true;
  const n = file.name.toLowerCase();
  return /\.(png|jpe?g|webp)$/i.test(n);
}

/** Resize and encode as JPEG base64 for vision APIs expecting raster data. */
export async function imageFileToJpegBase64(file: File, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const parts = dataUrl.split(',');
    const b64 = parts[1];
    if (!b64) throw new Error('Could not encode image');
    return b64;
  } finally {
    bitmap.close();
  }
}

export function isAllowedCopilotAttachment(file: File): boolean {
  if (isChatImageFile(file)) return true;
  const n = file.name.toLowerCase();
  const t = (file.type || '').toLowerCase();
  if (t.includes('pdf') || n.endsWith('.pdf')) return true;
  if (t.includes('wordprocessingml') || n.endsWith('.docx')) return true;
  if (t === 'text/plain' || n.endsWith('.txt')) return true;
  return false;
}

/** Build `attachmentContext` + vision `images` for `/api/chat/copilot`. */
export async function buildCopilotAttachmentPayload(
  items: ReadonlyArray<{ file: File }>,
  opts?: { maxImages?: number; maxTextChars?: number }
): Promise<{ attachmentContext?: string; images?: string[] }> {
  const maxImages = opts?.maxImages ?? 5;
  const maxTextChars = opts?.maxTextChars ?? 26000;
  const maxBytes = 15 * 1024 * 1024;
  const docChunks: string[] = [];
  const images: string[] = [];

  for (const { file } of items) {
    if (file.size > maxBytes) {
      throw new Error(`"${file.name}" is too large (max 15 MB).`);
    }
    if (isChatImageFile(file)) {
      if (images.length >= maxImages) continue;
      images.push(await imageFileToJpegBase64(file));
    } else {
      const text = (await extractTextFromFile(file)).trim();
      if (text) docChunks.push(`### ${file.name}\n${text}`);
    }
  }
  const merged = docChunks.join('\n\n').slice(0, maxTextChars);
  return {
    ...(merged ? { attachmentContext: merged } : {}),
    ...(images.length ? { images } : {}),
  };
}
