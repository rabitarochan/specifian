import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Authoring guides (`_guide.md`) are a "side file" like `_schema.json`:
 * they are NOT specs (excluded from scanDir) and are read directly per category.
 * The root guide lives at `<specsDir>/_guide.md`; a category guide at
 * `<specsDir>/<category>/_guide.md`. They capture, in prose, what information a
 * document in that category should record and the design conventions to follow —
 * complementing `_template.mdx` (skeleton) and `_schema.json` (structural contract).
 */

/** Return value of loadGuide. */
export interface GuideResult {
  /** Raw Markdown (including front-matter) on success; null when _guide.md is absent. */
  guide: string | null;
  /** Parsed from front-matter when present. */
  title?: string;
  description?: string;
  /** Set only when the file exists but cannot be read. */
  error?: string;
}

/** Resolve the absolute path of a category's _guide.md ('' = root). */
function guidePath(specsDir: string, category: string): string {
  const segments = category === '' ? [] : category.split('/');
  return path.join(specsDir, ...segments, '_guide.md');
}

/**
 * Read `<specsDir>/<category>/_guide.md`.
 * - File absent (ENOENT) → { guide: null }
 * - Read failure → { guide: null, error: <message> }
 * - Success → { guide: <raw>, title?, description? }
 */
export async function loadGuide(
  specsDir: string,
  category: string,
): Promise<GuideResult> {
  let text: string;
  try {
    text = await fs.readFile(guidePath(specsDir, category), 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { guide: null };
    }
    return { guide: null, error: `Failed to read _guide.md: ${String(err)}` };
  }

  // Best-effort front-matter parse for title/description; malformed YAML still returns the raw text.
  try {
    const parsed = matter(text);
    return {
      guide: text,
      title: parsed.data['title'] as string | undefined,
      description: parsed.data['description'] as string | undefined,
    };
  } catch {
    return { guide: text };
  }
}

/** Write (create or overwrite) a category's _guide.md, creating the directory if needed. */
export async function saveGuide(
  specsDir: string,
  category: string,
  content: string,
): Promise<void> {
  const target = guidePath(specsDir, category);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

/** Whether a category has a _guide.md. */
export async function hasGuide(specsDir: string, category: string): Promise<boolean> {
  try {
    await fs.access(guidePath(specsDir, category));
    return true;
  } catch {
    return false;
  }
}
