import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';
import { HttpError, json, requireEnv, serve } from '../_shared/util.ts';
import { docxText, extractJson, toBase64 } from './parse.ts';

const SYSTEM = `You extract structured data from CVs/resumes.
Respond with ONLY a JSON object, no prose and no code fences, matching exactly:
{"skills": string[], "years_experience": number, "roles": string[], "education": string[], "summary": string}
- skills: concrete technologies, tools and methodologies, lowercase, max 40.
- years_experience: total professional years as a number; estimate if not stated.
- roles: job titles held, most recent first.
- education: one line per qualification, e.g. "BSc Computer Science, TU Delft, 2019".
- summary: 2-3 sentences, third person, no marketing language.
Use [] or 0 for anything the CV does not contain. Never invent facts.`;

Deno.serve(serve(async (req, db, userId) => {
  const { cv_id } = await req.json().catch(() => ({}));
  if (typeof cv_id !== 'string' || !cv_id) throw new HttpError(400, 'cv_id is required');

  // RLS scopes this to the caller, so a foreign id simply returns nothing.
  const { data: cv, error } = await db
    .from('cvs').select('storage_path, mime_type, file_name').eq('id', cv_id).single();
  if (error || !cv) throw new HttpError(404, 'cv not found');

  const file = await db.storage.from('cvs').download(cv.storage_path);
  if (file.error || !file.data) throw new HttpError(404, 'cv file not found in storage');
  const bytes = new Uint8Array(await file.data.arrayBuffer());

  const isPdf = cv.mime_type === 'application/pdf' || cv.file_name.toLowerCase().endsWith('.pdf');
  // Claude reads PDFs natively — only .docx needs text extraction on our side.
  const content = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: toBase64(bytes) } },
        { type: 'text' as const, text: 'Extract the CV data as JSON.' },
      ]
    : [{ type: 'text' as const, text: `Extract the CV data as JSON.\n\nCV:\n${(await docxText(bytes)).slice(0, 60_000)}` }];

  const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  });

  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const parsed = extractJson(text);

  const { error: saveError } = await db.from('cvs').update({ parsed_json: parsed }).eq('id', cv_id);
  if (saveError) throw new Error(saveError.message);

  return json({ parsed_json: parsed });
}));
