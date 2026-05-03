export type SourceKind = "book" | "docs" | "types" | "modlib" | "fbexport";

export interface ServerConfig {
  sdkPath?: string;
  bookPath: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
}

export interface BookChapter {
  slug: string;
  fileName: string;
  title: string;
  path: string;
  text: string;
  lines: string[];
  headings: Heading[];
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface SearchResult {
  kind: SourceKind;
  id: string;
  title: string;
  path?: string;
  line?: number;
  snippet: string;
  url?: string;
  truncated?: boolean;
  detailAvailable?: boolean;
}

export interface SdkStatus {
  sdkPath?: string;
  exists: boolean;
  detected: Record<string, boolean>;
  missing: string[];
  version?: unknown;
  versionKind?: "file" | "directory" | "missing";
}

export interface SdkSymbol {
  name: string;
  kind: "function" | "enum" | "type" | "const" | "class" | "interface" | "export";
  source: "types" | "modlib";
  path: string;
  line: number;
  signatures: string[];
  detail: string;
}

export interface SdkDocument {
  kind: "docs" | "fbexport";
  id: string;
  title: string;
  path: string;
  size: number;
  lineCount: number;
}

export interface SdkIndex {
  status: SdkStatus;
  symbols: SdkSymbol[];
  documents: SdkDocument[];
}
