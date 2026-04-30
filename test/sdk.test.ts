import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSdkIndex, getSdkStatus, getSdkSymbol, parseTypeSymbols, searchSdk } from "../src/sdk.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bf6-sdk-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("sdk status", () => {
  it("reports missing SDK structure without throwing", async () => {
    await fs.mkdir(path.join(tempRoot, "code"), { recursive: true });
    const status = await getSdkStatus(tempRoot);
    expect(status.exists).toBe(true);
    expect(status.missing).toContain("modlib");
    expect(status.missing).toContain("types");
    expect(status.missing).toContain("version");
  });
});

describe("sdk symbol parsing", () => {
  it("groups overloaded declarations from index.d.ts", () => {
    const symbols = parseTypeSymbols(
      [
        "declare namespace mod {",
        "  export function SpawnAIFromAISpawner(spawner: Spawner): void;",
        "  export function SpawnAIFromAISpawner(spawner: Spawner, team: Team): void;",
        "  export enum Maps {",
        "    Test",
        "  }",
        "}"
      ].join("\n"),
      "/sdk/code/types/mod/index.d.ts"
    );

    const overload = symbols.find((symbol) => symbol.name === "SpawnAIFromAISpawner");
    expect(overload?.kind).toBe("function");
    expect(overload?.signatures).toHaveLength(2);
    expect(symbols.find((symbol) => symbol.name === "Maps")?.kind).toBe("enum");
  });

  it("indexes SDK documents and symbols", async () => {
    await fs.mkdir(path.join(tempRoot, "code", "types", "mod"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "code", "modlib"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "FbExportData"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "sdk.version.json"), JSON.stringify({ version: "1.2.3.0" }));
    await fs.writeFile(path.join(tempRoot, "code", "types", "mod", "index.d.ts"), "declare namespace mod {\n export function Wait(n: number): Promise<void>;\n}");
    await fs.writeFile(path.join(tempRoot, "code", "modlib", "index.ts"), "export function Concat(a: string, b: string) { return a + b; }");
    await fs.writeFile(path.join(tempRoot, "docs", "intro.md"), "# Intro\nPortal docs");
    await fs.writeFile(path.join(tempRoot, "FbExportData", "asset_types.json"), "{\"RuntimeSpawn_Test\": true}");

    const index = await buildSdkIndex(tempRoot);
    expect(index.status.missing).toEqual([]);
    expect(getSdkSymbol(index, "Wait", "types")).toHaveLength(1);
    expect(getSdkSymbol(index, "Concat", "modlib")).toHaveLength(1);
    expect(searchSdk(index, "RuntimeSpawn", ["fbexport"])).toHaveLength(1);
  });
});
