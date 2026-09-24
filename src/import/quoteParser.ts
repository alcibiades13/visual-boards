// Bulk quote import parser — blueprint §7. Pure function, no DOM.

export interface ParsedQuote {
  text: string;
  author?: string;
}

export interface ParseOptions {
  /** true: every non-empty line is a quote. false (default): blank lines separate quotes. */
  eachLine?: boolean;
}

const OPENING_QUOTES = '"“„«»‘\'‚';
const CLOSING_QUOTES = '"”“»«’\'‘';
const DASHES = '—–-';
const BULLET = /^(?:\d{1,3}[.)]|[•*·▪◦-])\s+/;
const SENTENCE_END = /[.!?…:;]$/;

/** Removes one pair of surrounding quotation marks: "…", „…“, “…”, «…». */
export function stripOuterQuotes(text: string): string {
  const s = text.trim();
  if (s.length >= 2 && OPENING_QUOTES.includes(s[0]!) && CLOSING_QUOTES.includes(s[s.length - 1]!)) {
    return s.slice(1, -1).trim();
  }
  return s;
}

/** An author is short, contains a letter, and does not read like the end of a sentence. */
function looksLikeAuthor(candidate: string): boolean {
  const s = candidate.trim();
  if (!s || s.length > 80) return false;
  const first = /\p{L}/u.exec(s)?.[0];
  if (!first || first !== first.toUpperCase()) return false; // names start with a capital
  if (s.split(/\s+/).length > 8) return false;
  if (SENTENCE_END.test(s) && !/\b\p{Lu}\.$/u.test(s)) return false; // allow "J. R. R."-style initials
  return true;
}

/** Finds the last author separator on a single line: `| A`, `— A`, `– A`, ` - A`. */
function splitInlineAuthor(line: string): ParsedQuote | null {
  let best: { index: number; length: number } | null = null;
  const pattern = /\s*\|\s*|\s*[—–]\s*|(?<=[\s"”“»'’])-\s+/g;
  for (const match of line.matchAll(pattern)) {
    best = { index: match.index, length: match[0].length };
  }
  if (!best || best.index === 0) return null;
  const text = line.slice(0, best.index);
  const author = line.slice(best.index + best.length);
  if (!looksLikeAuthor(author) || !stripOuterQuotes(text)) return null;
  return { text, author: author.trim() };
}

/** A line that consists only of `— Author`. */
function authorLine(line: string): string | null {
  const s = line.trim();
  if (!s || !DASHES.includes(s[0]!)) return null;
  const author = s.replace(/^[—–-]+\s*/, '');
  return looksLikeAuthor(author) ? author : null;
}

function finish(text: string, author: string | undefined): ParsedQuote | null {
  const clean = stripOuterQuotes(text.replace(BULLET, ''))
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
  if (!clean) return null;
  return author ? { text: clean, author: author.trim() } : { text: clean };
}

function parseBlock(lines: string[]): ParsedQuote | null {
  const last = lines[lines.length - 1];
  if (lines.length > 1 && last !== undefined) {
    const author = authorLine(last);
    if (author) return finish(lines.slice(0, -1).join('\n'), author);
  }
  const inline = splitInlineAuthor(last ?? '');
  if (inline) return finish([...lines.slice(0, -1), inline.text].join('\n'), inline.author);
  return finish(lines.join('\n'), undefined);
}

export function parseQuotes(input: string, options: ParseOptions = {}): ParsedQuote[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const result: ParsedQuote[] = [];

  if (options.eachLine) {
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const previous = result[result.length - 1];
      const author = authorLine(line);
      if (author && previous && !previous.author) {
        previous.author = author;
        continue;
      }
      const quote = parseBlock([line]);
      if (quote) result.push(quote);
    }
    return result;
  }

  let block: string[] = [];
  const flush = () => {
    if (block.length) {
      const quote = parseBlock(block);
      if (quote) result.push(quote);
    }
    block = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    // A lone "— Author" after a blank line still belongs to the previous quote.
    const previous = result[result.length - 1];
    const author = block.length === 0 ? authorLine(line) : null;
    if (author && previous && !previous.author) {
      previous.author = author;
      continue;
    }
    block.push(line);
  }
  flush();
  return result;
}

/** Key used to detect duplicates: case, punctuation and whitespace are ignored. */
export function quoteKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
