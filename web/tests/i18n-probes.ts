// Sample arguments for every template in web/src/strings.ts, read from its source with the
// TypeScript parser, so a test can call the English template and a catalog's translation with
// the same values and check the translation still shows each value English shows.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const STRINGS_FILE = fileURLToPath(new URL('../src/strings.ts', import.meta.url));

export interface TemplateProbe {
  /** The key path, such as "sheet.countLabel" or "nav.pages[2].label". */
  path: string;
  /** Argument lists to call it with (two when it takes a true or false). */
  calls: unknown[][];
  /** The text values each call passes, which must reappear in the output. */
  marks: string[];
}

const NUMBERS = [641, 587, 523, 719, 857, 433];
const TEXTS = ['qzpa', 'qzpb', 'qzpc', 'qzpd', 'qzpe', 'qzpf'];

function unwrap(node: ts.Expression): ts.Expression {
  let n = node;
  while (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) n = n.expression;
  return n;
}

function keyOf(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

/** Probe values for one parameter, or null for a type this helper cannot make up. */
function valuesFor(param: ts.ParameterDeclaration, index: number, source: ts.SourceFile): unknown[] | null {
  const type = param.type?.getText(source).replace(/\s+/g, '') ?? null;
  const init = param.initializer;
  if (!type) {
    if (!init) return null;
    if (ts.isStringLiteral(init)) return [TEXTS[index]];
    if (ts.isNumericLiteral(init)) return [NUMBERS[index]];
    if (init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword) return [true, false];
    return null;
  }
  const parts = type.split('|').filter((p) => p !== 'null' && p !== 'undefined');
  if (parts.length === 1 && parts[0] === 'number') return [NUMBERS[index]];
  if (parts.length === 1 && parts[0] === 'string') return [TEXTS[index]];
  if (parts.length === 1 && parts[0] === 'boolean') return [true, false];
  if (parts.length === 1 && parts[0] === 'string[]') return [[TEXTS[index], TEXTS[index + 1]]];
  if (parts.length === 1 && /^(readonly)?\[number,number\]$/.test(parts[0]!)) return [[1931, 1947]];
  if (parts.every((p) => /^'[^']*'$/.test(p))) return [parts[0]!.slice(1, -1)];
  return null;
}

function probeFor(path: string, fn: ts.ArrowFunction | ts.FunctionExpression, source: ts.SourceFile): TemplateProbe | null {
  const options = fn.parameters.map((p, i) => valuesFor(p, i, source));
  if (options.some((o) => o === null)) return null;
  let calls: unknown[][] = [[]];
  for (const choices of options as unknown[][]) calls = calls.flatMap((call) => choices.map((c) => [...call, c]));
  const marks = new Set<string>();
  for (const call of calls)
    for (const value of call) {
      if (typeof value === 'string' && TEXTS.includes(value)) marks.add(value);
      if (typeof value === 'number') marks.add(String(value));
    }
  return { path, calls, marks: [...marks] };
}

/** Every template in the English strings object with probe arguments, by key path. */
export function templateProbes(file: string = STRINGS_FILE): Map<string, TemplateProbe> {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = new Map<string, TemplateProbe>();
  const visit = (node: ts.Expression, path: string) => {
    const n = unwrap(node);
    if (ts.isObjectLiteralExpression(n)) {
      for (const prop of n.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = keyOf(prop.name);
        if (key !== null) visit(prop.initializer, path ? `${path}.${key}` : key);
      }
    } else if (ts.isArrayLiteralExpression(n)) {
      n.elements.forEach((el, i) => visit(el, `${path}[${i}]`));
    } else if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const probe = probeFor(path, n, source);
      if (probe) out.set(path, probe);
    }
  };
  source.forEachChild(function find(node) {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'strings' && decl.initializer) visit(decl.initializer, '');
      }
    }
  });
  return out;
}

/** The value at a key path such as "nav.pages[2].label" or "dossier.flags.absentee.careful". */
export function valueAt(root: unknown, path: string): unknown {
  let value: unknown = root;
  for (const part of path.split(/\.|\[|\]/).filter(Boolean)) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/** Whether `text` shows a probe value: a text value anywhere, a number as a whole number. */
export function shows(text: string, mark: string): boolean {
  const lower = text.toLowerCase();
  if (/^\d+$/.test(mark)) return new RegExp(`(^|[^\\d])${mark}([^\\d]|$)`).test(lower);
  return lower.includes(mark);
}
