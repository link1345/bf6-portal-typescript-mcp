import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildBookIndex, searchBook } from "../src/book.js";
import { parseArgs } from "../src/config.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bf6-book-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("book index", () => {
  it("loads only content/chapters markdown files", async () => {
    await fs.mkdir(path.join(tempRoot, "content", "chapters"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "content", "locales"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "content", "chapters", "1-intro.md"), "# Intro\nPortal chapter");
    await fs.writeFile(path.join(tempRoot, "content", "chapters", "2-rules.md"), "# Rules\nRule chapter");
    await fs.writeFile(path.join(tempRoot, "content", "chapters", "ignore.txt"), "# Ignore");
    await fs.writeFile(path.join(tempRoot, "content", "locales", "ja.md"), "# Locale");

    const index = await buildBookIndex(parseArgs(["--book-path", tempRoot]));

    expect(index.chapters).toHaveLength(2);
    expect(index.chapters.every((chapter) => chapter.path.includes("/content/chapters/"))).toBe(true);
    expect(index.chapters.some((chapter) => chapter.path.includes("/content/locales/"))).toBe(false);
    expect(index.chapters.map((chapter) => chapter.slug)).toEqual(["1-intro", "2-rules"]);
  });

  it("returns GitHub blob URLs for search results", async () => {
    await fs.mkdir(path.join(tempRoot, "content", "chapters"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "content", "chapters", "intro.md"), "# Intro\nPortal chapter");

    const index = await buildBookIndex(parseArgs(["--book-path", tempRoot]));

    const results = searchBook(index, "Portal", 1);
    expect(results[0]?.url).toContain("https://github.com/link1345/bf-portal-book/blob/main/content/chapters/");
    expect(results[0]?.url).toContain("#L");
  });
});
