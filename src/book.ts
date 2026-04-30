import fs from "node:fs/promises";
import path from "node:path";
import type { BookChapter, Heading, SearchResult, ServerConfig } from "./types.js";
import { pathExists } from "./fs-utils.js";
import { searchLines } from "./search.js";

export interface BookIndex {
  chapters: BookChapter[];
  bySlug: Map<string, BookChapter>;
  githubUrl(fileName: string, line?: number): string;
}

export async function buildBookIndex(config: ServerConfig): Promise<BookIndex> {
  const chaptersRoot = path.join(config.bookPath, "content", "chapters");
  const fileNames = (await pathExists(chaptersRoot))
    ? (await fs.readdir(chaptersRoot)).filter((name) => name.endsWith(".md")).sort(naturalCompare)
    : [];

  const chapters: BookChapter[] = [];
  for (const fileName of fileNames) {
    const fullPath = path.join(chaptersRoot, fileName);
    const text = await fs.readFile(fullPath, "utf8");
    const lines = text.split(/\r?\n/);
    const headings = extractHeadings(lines);
    chapters.push({
      slug: fileName.replace(/\.md$/u, ""),
      fileName,
      title: headings[0]?.text ?? fileName,
      path: fullPath,
      text,
      lines,
      headings
    });
  }

  return {
    chapters,
    bySlug: new Map(chapters.map((chapter) => [chapter.slug, chapter])),
    githubUrl(fileName: string, line?: number) {
      const base = `https://github.com/${config.githubOwner}/${config.githubRepo}/blob/${config.githubBranch}/content/chapters/${encodeURIComponent(fileName)}`;
      return line ? `${base}#L${line}` : base;
    }
  };
}

export function extractHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/u.exec(lines[index]);
    if (!match) continue;
    headings.push({ level: match[1].length, text: match[2], line: index + 1 });
  }
  return headings;
}

export function searchBook(index: BookIndex, query: string, limit = 20): SearchResult[] {
  const results: SearchResult[] = [];
  for (const chapter of index.chapters) {
    results.push(
      ...searchLines({
        kind: "book",
        id: chapter.slug,
        title: chapter.title,
        path: chapter.path,
        lines: chapter.lines,
        query,
        limit: Math.max(1, limit - results.length),
        urlForLine: (line) => index.githubUrl(chapter.fileName, line)
      })
    );
    if (results.length >= limit) break;
  }
  return results;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
