import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { BookIndex } from "./book.js";
import { searchBook } from "./book.js";
import type { SdkIndex } from "./types.js";
import { getSdkDocumentInfo, getSdkSymbol, listSdkSymbols, readSdkDocument, searchSdk } from "./sdk.js";
import { jsonText } from "./search.js";

const DEFAULT_BOOK_LINES = 120;
const MAX_BOOK_LINES = 500;
const DEFAULT_BOOK_CHARS = 8000;
const MAX_BOOK_CHARS = 30000;

export interface AppContext {
  book: BookIndex;
  sdk: SdkIndex;
}

export function createMcpServer(context: AppContext): McpServer {
  const server = new McpServer({
    name: "bf6-portal-typescript-mcp",
    version: "1.0.0"
  });

  registerResources(server, context);
  registerTools(server, context);
  return server;
}

export async function runStdioServer(context: AppContext): Promise<void> {
  const server = createMcpServer(context);
  await server.connect(new StdioServerTransport());
}

function registerResources(server: McpServer, context: AppContext): void {
  server.registerResource(
    "book_chapters",
    "bf6-portal://book/chapters",
    { title: "BF Portal book chapters", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: jsonText(context.book.chapters.map((chapter) => ({
        slug: chapter.slug,
        title: chapter.title,
        fileName: chapter.fileName,
        url: context.book.githubUrl(chapter.fileName)
      }))) }]
    })
  );

  server.registerResource(
    "book_chapter",
    new ResourceTemplate("bf6-portal://book/chapters/{slug}", { list: undefined }),
    { title: "BF Portal book chapter", mimeType: "application/json" },
    async (uri, variables) => {
      const slug = String(variables.slug ?? "");
      const chapter = context.book.bySlug.get(slug);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: jsonText(chapter ? bookChapterMetadata(context.book, chapter.slug) : { error: "chapter_not_found", slug })
        }]
      };
    }
  );

  server.registerResource(
    "sdk_status",
    "bf6-portal://sdk/status",
    { title: "BF6 Portal SDK status", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: jsonText(context.sdk.status) }] })
  );

  server.registerResource(
    "sdk_version",
    "bf6-portal://sdk/version",
    { title: "BF6 Portal SDK version", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: jsonText(context.sdk.status.version ?? null) }] })
  );

  server.registerResource(
    "sdk_types_symbol",
    new ResourceTemplate("bf6-portal://sdk/types/{symbol}", { list: undefined }),
    { title: "BF6 Portal SDK type symbol", mimeType: "application/json" },
    async (uri, variables) => {
      const symbol = String(variables.symbol ?? "");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: jsonText(getSdkSymbol(context.sdk, symbol, "types")) }] };
    }
  );

  server.registerResource(
    "sdk_modlib_symbol",
    new ResourceTemplate("bf6-portal://sdk/modlib/{symbol}", { list: undefined }),
    { title: "BF6 Portal SDK modlib symbol", mimeType: "application/json" },
    async (uri, variables) => {
      const symbol = String(variables.symbol ?? "");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: jsonText(getSdkSymbol(context.sdk, symbol, "modlib")) }] };
    }
  );

  server.registerResource(
    "sdk_docs",
    new ResourceTemplate("bf6-portal://sdk/docs/{path}", { list: undefined }),
    { title: "BF6 Portal SDK docs file", mimeType: "application/json" },
    async (uri, variables) => readSdkDocumentResource(uri.href, String(variables.path ?? ""), "docs", context)
  );

  server.registerResource(
    "sdk_fbexport",
    new ResourceTemplate("bf6-portal://sdk/fbexport/{path}", { list: undefined }),
    { title: "BF6 Portal SDK FbExportData file", mimeType: "application/json" },
    async (uri, variables) => readSdkDocumentResource(uri.href, String(variables.path ?? ""), "fbexport", context)
  );
}

function registerTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "search_book",
    {
      title: "Search unofficial BF Portal book",
      description: "Searches only content/chapters from the installed link1345/bf-portal-book data and returns GitHub blob links.",
      inputSchema: { query: z.string(), limit: z.number().int().positive().max(100).optional() }
    },
    async ({ query, limit }) => textResult({ results: searchBook(context.book, query, limit ?? 20) })
  );

  server.registerTool(
    "get_book_chapter",
    {
      title: "Get book chapter",
      description: "Returns book chapter metadata by slug. Text is omitted by default; request a bounded range with includeText, startLine, and lineCount.",
      inputSchema: {
        slug: z.string(),
        includeText: z.boolean().optional(),
        startLine: z.number().int().positive().optional(),
        lineCount: z.number().int().positive().max(MAX_BOOK_LINES).optional(),
        maxChars: z.number().int().positive().max(MAX_BOOK_CHARS).optional()
      }
    },
    async ({ slug, includeText, startLine, lineCount, maxChars }) => textResult(
      bookChapterResult(context.book, slug, { includeText, startLine, lineCount, maxChars })
    )
  );

  server.registerTool(
    "search_sdk",
    {
      title: "Search BF6 Portal SDK",
      description: "Searches SDK docs, type declarations, modlib exports, and FbExportData.",
      inputSchema: {
        query: z.string(),
        kinds: z.array(z.enum(["docs", "types", "modlib", "fbexport"])).optional(),
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async ({ query, kinds, limit }) => textResult({ results: await searchSdk(context.sdk, query, kinds, limit ?? 30) })
  );

  server.registerTool(
    "get_sdk_symbol",
    {
      title: "Get BF6 Portal SDK symbol",
      description: "Returns SDK type/modlib symbol details. Results are bounded unless maxChars is increased.",
      inputSchema: {
        name: z.string(),
        source: z.enum(["types", "modlib"]).optional(),
        includeDetail: z.boolean().optional(),
        maxChars: z.number().int().positive().max(20000).optional()
      }
    },
    async ({ name, source, includeDetail, maxChars }) => textResult({ results: getSdkSymbol(context.sdk, name, source, { includeDetail, maxChars }) })
  );

  server.registerTool(
    "list_sdk_symbols",
    {
      title: "List BF6 Portal SDK symbols",
      description: "Lists parsed SDK symbols with optional kind, source, and prefix filters.",
      inputSchema: {
        kind: z.enum(["function", "enum", "type", "const", "class", "interface", "export"]).optional(),
        source: z.enum(["types", "modlib"]).optional(),
        prefix: z.string().optional(),
        limit: z.number().int().positive().max(100).optional()
      }
    },
    async (args) => textResult({ results: listSdkSymbols(context.sdk, args) })
  );

  server.registerTool(
    "read_sdk_document",
    {
      title: "Read BF6 Portal SDK document range",
      description: "Reads a bounded range from SDK docs or FbExportData. Use this instead of resource reads for large files.",
      inputSchema: {
        kind: z.enum(["docs", "fbexport"]),
        path: z.string(),
        startLine: z.number().int().positive().optional(),
        lineCount: z.number().int().positive().max(500).optional(),
        maxChars: z.number().int().positive().max(20000).optional()
      }
    },
    async ({ kind, path, startLine, lineCount, maxChars }) => textResult(
      await readSdkDocument(context.sdk, kind, path, { startLine, lineCount, maxChars })
    )
  );

  server.registerTool(
    "get_sdk_status",
    {
      title: "Get BF6 Portal SDK status",
      description: "Returns SDK path diagnostics, detected folders, missing items, and version."
    },
    async () => textResult(context.sdk.status)
  );
}

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: jsonText(value) }]
  };
}

function readSdkDocumentResource(uri: string, id: string, kind: "docs" | "fbexport", context: AppContext) {
  const decoded = decodeURIComponent(id);
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: jsonText(getSdkDocumentInfo(context.sdk, kind, decoded))
    }]
  };
}

function bookChapterMetadata(book: BookIndex, slug: string) {
  const chapter = book.bySlug.get(slug);
  if (!chapter) return { error: "chapter_not_found", slug };
  return {
    slug: chapter.slug,
    title: chapter.title,
    headings: chapter.headings,
    url: book.githubUrl(chapter.fileName),
    lineCount: chapter.lines.length,
    size: Buffer.byteLength(chapter.text),
    textAvailable: true
  };
}

function bookChapterResult(
  book: BookIndex,
  slug: string,
  options: { includeText?: boolean; startLine?: number; lineCount?: number; maxChars?: number }
) {
  const chapter = book.bySlug.get(slug);
  if (!chapter) return { error: "chapter_not_found", slug };
  const result = bookChapterMetadata(book, slug);
  if (!options.includeText && options.startLine === undefined && options.lineCount === undefined) return result;

  const startLine = clampRangeStart(options.startLine, chapter.lines.length);
  const lineCount = clampLimit(options.lineCount, DEFAULT_BOOK_LINES, MAX_BOOK_LINES);
  const maxChars = clampLimit(options.maxChars, DEFAULT_BOOK_CHARS, MAX_BOOK_CHARS);
  const selected = chapter.lines.slice(startLine - 1, Math.min(chapter.lines.length, startLine - 1 + lineCount)).join("\n");
  const truncated = truncateText(selected, maxChars);
  return {
    ...result,
    startLine,
    endLine: Math.min(chapter.lines.length, startLine - 1 + lineCount),
    text: truncated.text,
    truncated: truncated.truncated || startLine - 1 + lineCount < chapter.lines.length
  };
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) return { text: value, truncated: false };
  return { text: `${value.slice(0, Math.max(0, maxChars - 25)).trimEnd()}\n... [truncated]`, truncated: true };
}

function clampLimit(value: number | undefined, defaultValue: number, maxValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(maxValue, Math.floor(value)));
}

function clampRangeStart(value: number | undefined, lineCount: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(Math.max(1, lineCount), Math.floor(value)));
}
