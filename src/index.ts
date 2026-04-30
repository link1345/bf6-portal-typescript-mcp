#!/usr/bin/env node
import { buildBookIndex } from "./book.js";
import { HelpRequested, parseArgs } from "./config.js";
import { runStdioServer } from "./mcp.js";
import { buildSdkIndex } from "./sdk.js";

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const [book, sdk] = await Promise.all([
    buildBookIndex(config),
    buildSdkIndex(config.sdkPath)
  ]);
  await runStdioServer({ book, sdk });
}

main().catch((error: unknown) => {
  if (error instanceof HelpRequested) {
    console.log(error.message);
    process.exit(0);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
