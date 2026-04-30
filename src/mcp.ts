import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { BookIndex } from "./book.js";
import { searchBook } from "./book.js";
import type { SdkIndex } from "./types.js";
import { getSdkSymbol, listSdkSymbols, searchSdk } from "./sdk.js";
import { jsonText } from "./search.js";

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
    { title: "BF Portal book chapter", mimeType: "text/markdown" },
    async (uri, variables) => {
      const slug = String(variables.slug ?? "");
      const chapter = context.book.bySlug.get(slug);
      return {
        contents: [{
          uri: uri.href,
          mimeType: chapter ? "text/markdown" : "application/json",
          text: chapter?.text ?? jsonText({ error: "chapter_not_found", slug })
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
    { title: "BF6 Portal SDK docs file", mimeType: "text/plain" },
    async (uri, variables) => readSdkDocumentResource(uri.href, String(variables.path ?? ""), "docs", context)
  );

  server.registerResource(
    "sdk_fbexport",
    new ResourceTemplate("bf6-portal://sdk/fbexport/{path}", { list: undefined }),
    { title: "BF6 Portal SDK FbExportData file", mimeType: "text/plain" },
    async (uri, variables) => readSdkDocumentResource(uri.href, String(variables.path ?? ""), "fbexport", context)
  );
}

function registerTools(server: McpServer, context: AppContext): void {
  server.registerTool(
    "search_book",
    {
      title: "Search unofficial BF Portal book",
      description: "Searches only content/chapters in the local link1345/bf-portal-book checkout and returns GitHub blob links.",
      inputSchema: { query: z.string(), limit: z.number().int().positive().max(100).optional() }
    },
    async ({ query, limit }) => textResult({ results: searchBook(context.book, query, limit ?? 20) })
  );

  server.registerTool(
    "get_book_chapter",
    {
      title: "Get book chapter",
      description: "Returns a book chapter by slug, including headings and GitHub source URL.",
      inputSchema: { slug: z.string() }
    },
    async ({ slug }) => {
      const chapter = context.book.bySlug.get(slug);
      return textResult(chapter
        ? {
            slug: chapter.slug,
            title: chapter.title,
            headings: chapter.headings,
            url: context.book.githubUrl(chapter.fileName),
            text: chapter.text
          }
        : { error: "chapter_not_found", slug });
    }
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
    async ({ query, kinds, limit }) => textResult({ results: searchSdk(context.sdk, query, kinds, limit ?? 30) })
  );

  server.registerTool(
    "get_sdk_symbol",
    {
      title: "Get BF6 Portal SDK symbol",
      description: "Returns SDK type/modlib symbol details. Function overloads are grouped by name.",
      inputSchema: { name: z.string(), source: z.enum(["types", "modlib"]).optional() }
    },
    async ({ name, source }) => textResult({ results: getSdkSymbol(context.sdk, name, source) })
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
        limit: z.number().int().positive().max(500).optional()
      }
    },
    async (args) => textResult({ results: listSdkSymbols(context.sdk, args) })
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
  const doc = context.sdk.documents.find((document) => document.kind === kind && document.id === decoded);
  return {
    contents: [{
      uri,
      mimeType: doc ? "text/plain" : "application/json",
      text: doc?.text ?? jsonText({ error: "document_not_found", kind, path: decoded })
    }]
  };
}
