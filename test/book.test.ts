import { describe, expect, it } from "vitest";
import { buildBookIndex, searchBook } from "../src/book.js";

describe("book index", () => {
  it("loads only content/chapters markdown files", async () => {
    const index = await buildBookIndex({
      bookPath: "/home/link/bf-portal-book",
      githubOwner: "link1345",
      githubRepo: "bf-portal-book",
      githubBranch: "main"
    });

    expect(index.chapters).toHaveLength(23);
    expect(index.chapters.every((chapter) => chapter.path.includes("/content/chapters/"))).toBe(true);
    expect(index.chapters.some((chapter) => chapter.path.includes("/content/locales/"))).toBe(false);
  });

  it("returns GitHub blob URLs for search results", async () => {
    const index = await buildBookIndex({
      bookPath: "/home/link/bf-portal-book",
      githubOwner: "link1345",
      githubRepo: "bf-portal-book",
      githubBranch: "main"
    });

    const results = searchBook(index, "Portal", 1);
    expect(results[0]?.url).toContain("https://github.com/link1345/bf-portal-book/blob/main/content/chapters/");
    expect(results[0]?.url).toContain("#L");
  });
});
