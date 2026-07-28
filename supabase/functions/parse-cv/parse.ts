import JSZip from 'npm:jszip@3.10.1';

/**
 * Claude is asked for bare JSON but may still wrap it in prose or a code fence.
 * Strip fences, then fall back to the outermost {...} span.
 */
export function extractJson(raw: string): Record<string, unknown> {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('model did not return JSON');
    return JSON.parse(s.slice(start, end + 1));
  }
}

/** A .docx is a zip; word/document.xml holds the text in <w:t> nodes. */
export async function docxText(bytes: Uint8Array): Promise<string> {
  const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml')?.async('string');
  if (!xml) throw new Error('not a valid .docx');
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** btoa() on a whole file blows the arg limit; chunk it. */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
