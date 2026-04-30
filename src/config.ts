import path from "node:path";
import type { ServerConfig } from "./types.js";

const DEFAULT_BOOK_PATH = "/home/link/bf-portal-book";

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const args = normalizeSubcommand(argv);
  let sdkPath: string | undefined;
  let bookPath = DEFAULT_BOOK_PATH;
  let githubOwner = "link1345";
  let githubRepo = "bf-portal-book";
  let githubBranch = "main";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const readValue = () => {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return value;
    };

    if (arg === "--sdk-path") sdkPath = readValue();
    else if (arg.startsWith("--sdk-path=")) sdkPath = arg.slice("--sdk-path=".length);
    else if (arg === "--book-path") bookPath = readValue();
    else if (arg.startsWith("--book-path=")) bookPath = arg.slice("--book-path=".length);
    else if (arg === "--github-owner") githubOwner = readValue();
    else if (arg.startsWith("--github-owner=")) githubOwner = arg.slice("--github-owner=".length);
    else if (arg === "--github-repo") githubRepo = readValue();
    else if (arg.startsWith("--github-repo=")) githubRepo = arg.slice("--github-repo=".length);
    else if (arg === "--github-branch") githubBranch = readValue();
    else if (arg.startsWith("--github-branch=")) githubBranch = arg.slice("--github-branch=".length);
    else if (arg === "--help" || arg === "-h") {
      throw new HelpRequested();
    }
  }

  sdkPath ??= env.BF6_PORTAL_SDK_PATH;

  return {
    sdkPath: sdkPath ? path.resolve(sdkPath) : undefined,
    bookPath: path.resolve(bookPath),
    githubOwner,
    githubRepo,
    githubBranch
  };
}

export class HelpRequested extends Error {
  constructor() {
    super(helpText());
    this.name = "HelpRequested";
  }
}

export function helpText(): string {
  return [
    "Usage:",
    "  bf6-portal-typescript-mcp mcp [--sdk-path /path/to/sdk] [--book-path /path/to/bf-portal-book]",
    "  bf6-portal-mcp [--sdk-path /path/to/sdk] [--book-path /path/to/bf-portal-book]",
    "",
    "Environment:",
    "  BF6_PORTAL_SDK_PATH  SDK root used when --sdk-path is not provided."
  ].join("\n");
}

function normalizeSubcommand(argv: string[]): string[] {
  if (argv[0] === "mcp") return argv.slice(1);
  return argv;
}
