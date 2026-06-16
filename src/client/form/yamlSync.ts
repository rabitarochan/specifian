/**
 * yamlSync.ts — front-matter split / replace utilities
 *
 * Pure functions that run in the browser. No Node.js imports.
 * Uses the yaml package (v2.x) for parse / stringify.
 */

import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export interface FrontMatterParts {
  data: Record<string, unknown>;
  /** Body text with the front-matter block removed (leading blank line stripped). */
  body: string;
  hasFrontMatter: boolean;
  /** Set only on YAML parse failure; in that case data is {}. */
  error?: string;
}

/**
 * Helper that splits text into lines without normalizing CRLF / LF.
 * Trailing CR is preserved in the returned lines (so body line endings are unchanged even for CRLF content).
 */
function splitLines(text: string): string[] {
  return text.split('\n');
}

/**
 * Determines whether content has a front-matter block.
 * Condition: the first line is "---" (or "---\r" for CRLF).
 */
function startsWithFrontMatterDelimiter(content: string): boolean {
  const firstNewline = content.indexOf('\n');
  const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
  // Strip trailing CR before comparing
  return firstLine.replace(/\r$/, '') === '---';
}

/**
 * Returns the index of the closing delimiter line (the second "---" line) of the front-matter block.
 * Returns -1 if not found.
 * Assumes lines[0] is "---" (or "---\r").
 */
function findClosingDelimiterIndex(lines: string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '---') {
      return i;
    }
  }
  return -1;
}

/**
 * Splits content into front-matter YAML data and body.
 *
 * - Front-matter detection: first line is exactly "---" (CRLF-aware)
 * - Closing delimiter: the next line that is exactly "---"
 * - YAML parse failure: data = {}, sets error message
 * - YAML result is not an object (scalar / array / null): data = {}, sets error message
 */
export function splitFrontMatter(content: string): FrontMatterParts {
  if (!startsWithFrontMatterDelimiter(content)) {
    return { data: {}, body: content, hasFrontMatter: false };
  }

  const lines = splitLines(content);
  const closingIdx = findClosingDelimiterIndex(lines);

  if (closingIdx === -1) {
    // "---" is unclosed → treat as no front-matter
    return { data: {}, body: content, hasFrontMatter: false };
  }

  // YAML block: lines[1] .. lines[closingIdx - 1]
  const yamlLines = lines.slice(1, closingIdx);
  const yamlText = yamlLines.join('\n');

  // Body: lines[closingIdx + 1] onward. Strip the leading blank line.
  const bodyLines = lines.slice(closingIdx + 1);
  // Strip one leading blank line (or "\r")
  let body: string;
  if (bodyLines.length > 0 && bodyLines[0].replace(/\r$/, '') === '') {
    body = bodyLines.slice(1).join('\n');
  } else {
    body = bodyLines.join('\n');
  }

  let parsed: unknown;
  try {
    parsed = yamlParse(yamlText);
  } catch (err) {
    return {
      data: {},
      body,
      hasFrontMatter: true,
      error: `Failed to parse YAML: ${String(err)}`,
    };
  }

  if (parsed === null || parsed === undefined) {
    // Empty YAML block → treat as empty object (no error)
    return { data: {}, body, hasFrontMatter: true };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      data: {},
      body,
      hasFrontMatter: true,
      error: `front-matter must be an object (actual type: ${Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }

  return {
    data: parsed as Record<string, unknown>,
    body,
    hasFrontMatter: true,
  };
}

/**
 * Replaces the front-matter portion of content with data and returns the result.
 *
 * - If front-matter exists: re-serializes the YAML block and substitutes it.
 *   Empty data object → replaces with a `---\n---`-only block.
 * - If front-matter does not exist:
 *   Empty data object → returns content unchanged.
 *   Non-empty data → prepends `---\n<yaml>---\n\n` to the content.
 *
 * Body line endings are not changed (only the YAML block is regenerated).
 * YAML serialization uses lineWidth: 0 (no wrapping); key order follows insertion order.
 */
export function replaceFrontMatter(
  content: string,
  data: Record<string, unknown>,
): string {
  const isEmpty = Object.keys(data).length === 0;

  if (!startsWithFrontMatterDelimiter(content)) {
    // No front-matter
    if (isEmpty) {
      return content;
    }
    const yamlBlock = yamlStringify(data, { lineWidth: 0 });
    return `---\n${yamlBlock}---\n\n${content}`;
  }

  const lines = splitLines(content);
  const closingIdx = findClosingDelimiterIndex(lines);

  if (closingIdx === -1) {
    // Unclosed front-matter — inserting a new block at the top would be confusing,
    // so return content unchanged
    return content;
  }

  // Body (closingIdx + 1 onward) is kept as-is
  const bodyLines = lines.slice(closingIdx + 1);
  const bodySuffix = bodyLines.join('\n');

  // Preserve the line-ending style of the opening "---" line (CRLF or LF)
  const firstLineHasCR = lines[0].endsWith('\r');
  const delim = firstLineHasCR ? '---\r' : '---';

  if (isEmpty) {
    // Empty block
    return `${delim}\n${delim}\n${bodySuffix}`;
  }

  const yamlBlock = yamlStringify(data, { lineWidth: 0 });
  // yamlBlock always ends with LF (yaml package specification)
  return `${delim}\n${yamlBlock}${delim}\n${bodySuffix}`;
}
