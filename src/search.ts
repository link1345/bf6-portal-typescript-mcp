import type { SearchResult, SourceKind } from "./types.js";

export function makeSnippet(lines: string[], lineIndex: number, radius = 1): string {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length, lineIndex + radius + 1);
  return lines
    .slice(start, end)
    .map((line, offset) => `${start + offset + 1}: ${line}`)
    .join("\n")
    .trim();
}

export function searchLines(options: {
  kind: SourceKind;
  id: string;
  title: string;
  lines: string[];
  query: string;
  path?: string;
  urlForLine?: (line: number) => string;
  limit?: number;
}): SearchResult[] {
  const query = options.query.trim().toLowerCase();
  if (!query) return [];

  const limit = options.limit ?? 10;
  const results: SearchResult[] = [];
  for (let index = 0; index < options.lines.length; index += 1) {
    if (!options.lines[index].toLowerCase().includes(query)) continue;
    const line = index + 1;
    results.push({
      kind: options.kind,
      id: options.id,
      title: options.title,
      path: options.path,
      line,
      snippet: makeSnippet(options.lines, index),
      url: options.urlForLine?.(line)
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
