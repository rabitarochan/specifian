import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { render, createContext, defineHelper } from '@scaffdog/engine';
import type { HelperMap, Variable } from '@scaffdog/types';
import type { SpecMeta, GeneratedFile } from '../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

function specMetaToVariable(spec: SpecMeta): Variable {
  return {
    id: spec.id,
    category: spec.category,
    slug: spec.slug,
    path: spec.path,
    title: spec.title,
    description: spec.description ?? '',
    data: spec.data as Variable,
    links: spec.links as unknown as Variable,
    isIndex: spec.isIndex,
  } as unknown as Variable;
}

function specsToVariable(specs: SpecMeta[]): Variable {
  return specs.map(specMetaToVariable) as unknown as Variable;
}

function buildHelpers(): HelperMap {
  const helpers: HelperMap = new Map();

  defineHelper(helpers, 'pascal', (_ctx, value: string) => {
    if (typeof value !== 'string') return String(value);
    return value
      .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (c: string) => c.toUpperCase());
  });

  defineHelper(helpers, 'camel', (_ctx, value: string) => {
    if (typeof value !== 'string') return String(value);
    const pascal = value
      .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (c: string) => c.toUpperCase());
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  });

  defineHelper(helpers, 'upper', (_ctx, value: string) => {
    if (typeof value !== 'string') return String(value);
    return value.toUpperCase();
  });

  defineHelper(helpers, 'lower', (_ctx, value: string) => {
    if (typeof value !== 'string') return String(value);
    return value.toLowerCase();
  });

  defineHelper(helpers, 'snake', (_ctx, value: string) => {
    if (typeof value !== 'string') return String(value);
    return value
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .replace(/^_/, '')
      .toLowerCase();
  });

  // カラムオブジェクトを受け取り nullable: true のときだけ "?" を返す
  // (scaffdog エンジンは undefined と boolean の比較を許さず、
  //  "null" で始まる識別子は null リテラルとして字句解析されるため、この名前にしている)
  defineHelper(helpers, 'optionalMark', (_ctx, value: unknown) => {
    if (value && typeof value === 'object' && (value as Record<string, unknown>).nullable === true) {
      return '?';
    }
    return '';
  });

  // SQL type -> TypeScript type mapping
  defineHelper(helpers, 'tsType', (_ctx, value: string) => {
    if (typeof value !== 'string') return 'unknown';
    const v = value.toLowerCase().trim();
    if (v.startsWith('bigint') || v.startsWith('int') || v.startsWith('smallint') || v.startsWith('tinyint') || v.startsWith('numeric') || v.startsWith('decimal') || v.startsWith('float') || v.startsWith('double') || v.startsWith('real')) return 'number';
    if (v.startsWith('bool')) return 'boolean';
    if (v.startsWith('json') || v.startsWith('jsonb')) return 'Record<string, unknown>';
    if (v.startsWith('timestamp') || v.startsWith('date') || v.startsWith('time')) return 'string';
    // varchar, text, char, uuid, etc.
    return 'string';
  });

  return helpers;
}

interface GeneratorSection {
  filename: string;
  template: string;
}

function parseGeneratorDoc(content: string): GeneratorSection[] {
  const parsed = matter(content);
  const body = parsed.content;
  const sections: GeneratorSection[] = [];

  // H1 headings with backtick filenames (# `filename`), each followed by a fenced code block
  const headingPattern = /^#\s+`([^`]+)`\s*$/gm;
  const marks: { filename: string; headStart: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingPattern.exec(body)) !== null) {
    marks.push({ filename: m[1].trim(), headStart: m.index, bodyStart: m.index + m[0].length });
  }
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].headStart : body.length;
    const segment = body.slice(mark.bodyStart, end);
    const fenceMatch = /^```[^\n]*\n([\s\S]*?)^```/m.exec(segment);
    if (fenceMatch) {
      sections.push({ filename: mark.filename, template: fenceMatch[1] });
    }
  });

  return sections;
}

export async function listGenerators(specsDir: string): Promise<string[]> {
  const generatorsDir = path.join(specsDir, '_generators');
  try {
    const entries = await fs.readdir(generatorsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.md$/.test(e.name))
      .map((e) => e.name.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

export async function runGenerator(
  specsDir: string,
  generator: string,
  allSpecs: SpecMeta[],
  specId?: string,
  outDir?: string,
): Promise<GeneratedFile[]> {
  const generatorPath = path.join(specsDir, '_generators', `${generator}.md`);

  let generatorContent: string;
  try {
    generatorContent = await fs.readFile(generatorPath, 'utf-8');
  } catch {
    throw new Error(`ジェネレーター "${generator}" が見つかりません: ${generatorPath}`);
  }

  const sections = parseGeneratorDoc(generatorContent);
  if (sections.length === 0) {
    throw new Error(`ジェネレーター "${generator}" にテンプレートセクションが見つかりません`);
  }

  // Determine target specs
  const targetSpecs =
    specId != null
      ? allSpecs.filter((s) => s.id === specId)
      : allSpecs.filter((s) => !s.isIndex && s.slug !== '_template');

  if (specId != null && targetSpecs.length === 0) {
    throw new Error(`スペック "${specId}" が見つかりません`);
  }

  const helpers = buildHelpers();
  const allSpecsVar = specsToVariable(allSpecs);

  const files: GeneratedFile[] = [];

  for (const spec of targetSpecs) {
    const specVar = specMetaToVariable(spec);

    const variables: Map<string, Variable> = new Map([
      ['spec', specVar],
      ['specs', allSpecsVar],
    ]);

    const context = createContext({ variables, helpers });

    for (const section of sections) {
      // Render filename template
      const renderedFilename = render(section.filename, context);
      const renderedContent = render(section.template, context);

      const filePath = normalizePath(renderedFilename);

      if (outDir != null) {
        const absOut = path.resolve(outDir, renderedFilename);
        await fs.mkdir(path.dirname(absOut), { recursive: true });
        await fs.writeFile(absOut, renderedContent, 'utf-8');
      }

      files.push({ path: filePath, content: renderedContent });
    }
  }

  return files;
}
