import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildBookIndex } from "../src/book.js";
import { parseArgs } from "../src/config.js";
import { createMcpServer } from "../src/mcp.js";
import { buildSdkIndex } from "../src/sdk.js";

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
});
