// Tiny, safe text formatting for CMS text: HTML is escaped, *word* becomes italic,
// a blank line starts a new paragraph and a single line break becomes <br>.
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inline(s: string): string {
  return escape(s.trim())
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

export const lines = (s: string) => inline(s).split(/\r?\n/).join('<br>');

export const paragraphs = (s: string) =>
  s
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => lines(p));
