import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildBookIndex } from "../src/book.js";
import { parseArgs } from "../src/config.js";
import { createMcpServer } from "../src/mcp.js";
import { buildSdkIndex } from "../src/sdk.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bf6-mcp-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("mcp server", () => {
  it("creates a server even when SDK path is absent", async () => {
    const book = await buildBookIndex(parseArgs([]));
    const sdk = await buildSdkIndex(undefined);
    const server = createMcpServer({ book, sdk });
    expect(server.isConnected()).toBe(false);
  });

  it("returns JSON tool results for empty searches and invalid lookups", async () => {
    const book = await buildBookIndex(parseArgs([]));
    const sdk = await buildSdkIndex(undefined);
    const server = createMcpServer({ book, sdk });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("search_book");

      const searchResult = await client.callTool({ name: "search_sdk", arguments: { query: "definitely-no-hit" } });
      expect(searchResult.content[0]?.type).toBe("text");
      expect(JSON.parse(searchResult.content[0]?.type === "text" ? searchResult.content[0].text : "")).toEqual({ results: [] });

      const chapterResult = await client.callTool({ name: "get_book_chapter", arguments: { slug: "missing" } });
      expect(chapterResult.content[0]?.type).toBe("text");
      expect(JSON.parse(chapterResult.content[0]?.type === "text" ? chapterResult.content[0].text : "")).toEqual({ error: "chapter_not_found", slug: "missing" });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("omits book chapter text by default and returns bounded text on request", async () => {
    const book = await buildBookIndex(parseArgs([]));
    const sdk = await buildSdkIndex(undefined);
    const server = createMcpServer({ book, sdk });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const slug = book.chapters[0]?.slug ?? "";

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const metadataResult = await client.callTool({ name: "get_book_chapter", arguments: { slug } });
      const metadata = parseTextResult(metadataResult);
      expect(metadata).not.toHaveProperty("text");
      expect(metadata).toHaveProperty("textAvailable", true);

      const textResult = await client.callTool({ name: "get_book_chapter", arguments: { slug, includeText: true, lineCount: 2, maxChars: 200 } });
      const text = parseTextResult(textResult);
      expect(text).toHaveProperty("text");
      expect(text.endLine - text.startLine + 1).toBeLessThanOrEqual(2);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("exposes lightweight SDK tools and bounded document reads", async () => {
    await fs.mkdir(path.join(tempRoot, "code", "types", "mod"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "code", "modlib"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "FbExportData"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "code", "types", "mod", "index.d.ts"), "export enum PlayerEvents {\n  PlayerSpawn,\n  PlayerDeath,\n}");
    await fs.writeFile(path.join(tempRoot, "FbExportData", "asset_types.json"), Array.from({ length: 10 }, (_, i) => `{"line":${i}}`).join("\n"));

    const book = await buildBookIndex(parseArgs([]));
    const sdk = await buildSdkIndex(tempRoot);
    const server = createMcpServer({ book, sdk });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("read_sdk_document");

      const listResult = await client.callTool({ name: "list_sdk_symbols", arguments: { limit: 1 } });
      const list = parseTextResult(listResult);
      expect(list.results[0]).not.toHaveProperty("detail");
      expect(list.results[0]).toHaveProperty("path", "code/types/mod/index.d.ts");

      const searchResult = await client.callTool({ name: "search_sdk", arguments: { query: "Player", kinds: ["types"], limit: 1 } });
      const search = parseTextResult(searchResult);
      expect(search.results[0]).toHaveProperty("detailAvailable", true);

      const documentResult = await client.callTool({ name: "read_sdk_document", arguments: { kind: "fbexport", path: "asset_types.json", startLine: 2, lineCount: 2 } });
      const document = parseTextResult(documentResult);
      expect(document).toMatchObject({ startLine: 2, endLine: 3, truncated: true });
      expect(document.text).toContain("\"line\":1");
      expect(document.text).not.toContain("\"line\":4");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function parseTextResult(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content[0];
  if (content?.type !== "text") throw new Error("Expected text result");
  return JSON.parse(content.text);
}
