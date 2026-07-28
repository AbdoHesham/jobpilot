// deno test supabase/functions/parse-cv/parse_test.ts
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { extractJson, toBase64 } from './parse.ts';

Deno.test('extractJson: bare object', () => {
  assertEquals(extractJson('{"skills":["dart"]}'), { skills: ['dart'] });
});

Deno.test('extractJson: fenced', () => {
  assertEquals(extractJson('```json\n{"years_experience":7}\n```'), { years_experience: 7 });
});

Deno.test('extractJson: wrapped in prose', () => {
  assertEquals(extractJson('Here you go:\n{"summary":"x"}\nHope that helps!'), { summary: 'x' });
});

Deno.test('extractJson: braces inside string values survive the fallback', () => {
  assertEquals(extractJson('note {"summary":"uses {} syntax"} end'), { summary: 'uses {} syntax' });
});

Deno.test('extractJson: no JSON at all throws', () => {
  assertThrows(() => extractJson('I cannot read this file.'));
});

Deno.test('toBase64 handles inputs larger than one chunk', () => {
  const bytes = new Uint8Array(0x8000 + 5).fill(65);
  assertEquals(atob(toBase64(bytes)).length, bytes.length);
});
