import fs from "node:fs/promises";
import path from "node:path";
import type { SdkDocument, SdkIndex, SdkStatus, SdkSymbol } from "./types.js";
import { pathExists, readTextIfExists, relativePosix, walkFiles } from "./fs-utils.js";
import { searchLines } from "./search.js";
import type { SearchResult } from "./types.js";

const SDK_ITEMS = {
  modlib: "code/modlib",
  types: "code/types",
  docs: "docs",
  fbexport: "FbExportData",
  version: "sdk.version.json"
} as const;

export async function buildSdkIndex(sdkPath?: string): Promise<SdkIndex> {
  const status = await getSdkStatus(sdkPath);
  const symbols: SdkSymbol[] = [];
  const documents: SdkDocument[] = [];

  if (!sdkPath || !status.exists) return { status, symbols, documents };

  const typesRoot = path.join(sdkPath, SDK_ITEMS.types);
  const modlibRoot = path.join(sdkPath, SDK_ITEMS.modlib);
  const docsRoot = path.join(sdkPath, SDK_ITEMS.docs);
  const fbexportRoot = path.join(sdkPath, SDK_ITEMS.fbexport);

  for (const filePath of await walkFiles(typesRoot, (file) => file.endsWith(".d.ts"))) {
    const text = await fs.readFile(filePath, "utf8");
    symbols.push(...parseTypeSymbols(text, filePath));
  }

  for (const filePath of await walkFiles(modlibRoot, (file) => /\.(?:ts|d\.ts|js)$/u.test(file))) {
    const text = await fs.readFile(filePath, "utf8");
    symbols.push(...parseModlibSymbols(text, filePath));
  }

  for (const filePath of await walkFiles(docsRoot, isTextLikeFile)) {
    const text = await fs.readFile(filePath, "utf8");
    const rel = relativePosix(docsRoot, filePath);
    documents.push({ kind: "docs", id: rel, title: titleFromText(text, rel), path: filePath, text, lines: text.split(/\r?\n/) });
  }

  for (const filePath of await walkFiles(fbexportRoot, isTextLikeFile)) {
    const text = await fs.readFile(filePath, "utf8");
    const rel = relativePosix(fbexportRoot, filePath);
    documents.push({ kind: "fbexport", id: rel, title: rel, path: filePath, text, lines: text.split(/\r?\n/) });
  }

  return { status, symbols, documents };
}

export async function getSdkStatus(sdkPath?: string): Promise<SdkStatus> {
  if (!sdkPath) {
    return {
      sdkPath,
      exists: false,
      detected: Object.fromEntries(Object.keys(SDK_ITEMS).map((key) => [key, false])),
      missing: Object.keys(SDK_ITEMS),
      versionKind: "missing"
    };
  }

  const exists = await pathExists(sdkPath);
  const detected: Record<string, boolean> = {};
  for (const [key, rel] of Object.entries(SDK_ITEMS)) {
    detected[key] = exists && (await pathExists(path.join(sdkPath, rel)));
  }

  const versionPath = path.join(sdkPath, SDK_ITEMS.version);
  let versionKind: SdkStatus["versionKind"] = "missing";
  let version: unknown;
  if (detected.version) {
    const stat = await fs.stat(versionPath);
    versionKind = stat.isDirectory() ? "directory" : "file";
    if (stat.isFile()) {
      const text = await readTextIfExists(versionPath);
      version = parseJsonOrText(text);
    }
  }

  return {
    sdkPath,
    exists,
    detected,
    missing: Object.entries(detected).filter(([, ok]) => !ok).map(([key]) => key),
    version,
    versionKind
  };
}

export function parseTypeSymbols(text: string, filePath: string): SdkSymbol[] {
  const lines = text.split(/\r?\n/);
  const symbols = new Map<string, SdkSymbol>();
  const patterns: Array<[SdkSymbol["kind"], RegExp]> = [
    ["function", /^\s*export\s+function\s+([A-Za-z_$][\w$]*)\s*\((.*)$/u],
    ["enum", /^\s*export\s+enum\s+([A-Za-z_$][\w$]*)\b/u],
    ["type", /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\b/u],
    ["const", /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\b/u],
    ["interface", /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)\b/u]
  ];

  for (let index = 0; index < lines.length; index += 1) {
    for (const [kind, pattern] of patterns) {
      const match = pattern.exec(lines[index]);
      if (!match) continue;
      const name = match[1];
      const signature = collectDeclaration(lines, index);
      const key = `types:${kind}:${name}`;
      const existing = symbols.get(key);
      if (existing) {
        existing.signatures.push(signature);
        existing.detail += `\n${signature}`;
      } else {
        symbols.set(key, {
          name,
          kind,
          source: "types",
          path: filePath,
          line: index + 1,
          signatures: [signature],
          detail: signature
        });
      }
    }
  }
  return [...symbols.values()];
}

export function parseModlibSymbols(text: string, filePath: string): SdkSymbol[] {
  const lines = text.split(/\r?\n/);
  const symbols: SdkSymbol[] = [];
  const patterns: Array<[SdkSymbol["kind"], RegExp]> = [
    ["function", /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/u],
    ["class", /^\s*export\s+class\s+([A-Za-z_$][\w$]*)\b/u],
    ["type", /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\b/u],
    ["interface", /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)\b/u],
    ["const", /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\b/u],
    ["export", /^\s*export\s+\{\s*([^}]+)\s*\}/u]
  ];

  for (let index = 0; index < lines.length; index += 1) {
    for (const [kind, pattern] of patterns) {
      const match = pattern.exec(lines[index]);
      if (!match) continue;
      if (kind === "export") {
        for (const part of match[1].split(",")) {
          const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
          if (!name) continue;
          const detail = lines[index].trim();
          symbols.push({ name, kind, source: "modlib", path: filePath, line: index + 1, signatures: [detail], detail });
        }
      } else {
        const detail = collectDeclaration(lines, index);
        symbols.push({ name: match[1], kind, source: "modlib", path: filePath, line: index + 1, signatures: [detail], detail });
      }
    }
  }
  return symbols;
}

export function searchSdk(index: SdkIndex, query: string, kinds?: Array<"docs" | "types" | "modlib" | "fbexport">, limit = 30): SearchResult[] {
  const wanted = new Set(kinds?.length ? kinds : ["docs", "types", "modlib", "fbexport"]);
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const results: SearchResult[] = [];

  for (const symbol of index.symbols) {
    if (!wanted.has(symbol.source)) continue;
    const haystack = `${symbol.name}\n${symbol.detail}`.toLowerCase();
    if (!haystack.includes(normalized)) continue;
    results.push({
      kind: symbol.source,
      id: symbol.name,
      title: `${symbol.name} (${symbol.kind})`,
      path: symbol.path,
      line: symbol.line,
      snippet: symbol.detail
    });
    if (results.length >= limit) return results;
  }

  for (const doc of index.documents) {
    if (!wanted.has(doc.kind)) continue;
    results.push(
      ...searchLines({
        kind: doc.kind,
        id: doc.id,
        title: doc.title,
        path: doc.path,
        lines: doc.lines,
        query,
        limit: Math.max(1, limit - results.length)
      })
    );
    if (results.length >= limit) return results;
  }

  return results;
}

export function getSdkSymbol(index: SdkIndex, name: string, source?: "types" | "modlib"): SdkSymbol[] {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  return index.symbols.filter((symbol) => {
    if (source && symbol.source !== source) return false;
    return symbol.name.toLowerCase() === needle;
  });
}

export function listSdkSymbols(index: SdkIndex, options: { kind?: SdkSymbol["kind"]; source?: "types" | "modlib"; prefix?: string; limit?: number }): SdkSymbol[] {
  const prefix = options.prefix?.toLowerCase();
  const limit = options.limit ?? 100;
  return index.symbols
    .filter((symbol) => !options.kind || symbol.kind === options.kind)
    .filter((symbol) => !options.source || symbol.source === options.source)
    .filter((symbol) => !prefix || symbol.name.toLowerCase().startsWith(prefix))
    .slice(0, limit);
}

function collectDeclaration(lines: string[], start: number): string {
  const collected: string[] = [];
  let braceBalance = 0;
  for (let index = start; index < Math.min(lines.length, start + 80); index += 1) {
    const line = lines[index];
    collected.push(line.trimEnd());
    braceBalance += countChar(line, "{") - countChar(line, "}");
    const trimmed = line.trim();
    if ((trimmed.endsWith(";") || trimmed.endsWith("}") || trimmed.endsWith("};")) && braceBalance <= 0) break;
    if (index > start && braceBalance <= 0 && /^[\s})]*$/u.test(trimmed)) break;
  }
  return collected.join("\n").trim();
}

function countChar(value: string, char: string): number {
  return [...value].filter((current) => current === char).length;
}

function isTextLikeFile(filePath: string): boolean {
  return /\.(?:md|markdown|txt|json|jsonc|yaml|yml|csv|ts|d\.ts|js)$/iu.test(filePath);
}

function titleFromText(text: string, fallback: string): string {
  const heading = /^#\s+(.+)$/mu.exec(text);
  return heading?.[1]?.trim() || fallback;
}

function parseJsonOrText(text?: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text.trim();
  }
}
