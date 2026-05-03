# BF6 Portal TypeScript MCP


[![NPM Version](https://img.shields.io/npm/v/bf6-portal-typescript-mcp)](https://www.npmjs.com/package/bf6-portal-typescript-mcp)
[![NPM License](https://img.shields.io/npm/l/bf6-portal-typescript-mcp)](https://github.com/link1345/bf6-portal-typescript-mcp/blob/main/LICENSE)
![NPM Downloads](https://img.shields.io/npm/dw/bf6-portal-typescript-mcp)
![GitHub last commit](https://img.shields.io/github/last-commit/link1345/bf6-portal-typescript-mcp)
[![Discord](https://img.shields.io/discord/1329272750099136552)](https://discord.gg/Zy65k8AxH2)

Reference and search MCP server for the BF6 Portal TypeScript SDK and the unofficial BF Portal book.

## Usage

Run from npm:

```bash
npx bf6-portal-typescript-mcp@latest mcp --sdk-path /path/to/bf6-portal-sdk
```

You can also install it globally:

```bash
npm install -g bf6-portal-typescript-mcp
bf6-portal-typescript-mcp mcp --sdk-path /path/to/bf6-portal-sdk
```

Local development:

```bash
npm install
npm run build
node dist/index.js mcp --sdk-path /path/to/bf6-portal-sdk
```

`--sdk-path` is optional when `BF6_PORTAL_SDK_PATH` is set.

```bash
BF6_PORTAL_SDK_PATH=/path/to/bf6-portal-sdk npx bf6-portal-typescript-mcp@latest mcp
```

Book data is downloaded automatically from `link1345/bf-portal-book` when this package is installed.

## MCP Client Config

Example configuration for clients that launch stdio MCP servers:

```json
{
  "mcpServers": {
    "bf6-portal": {
      "command": "npx",
      "args": [
        "bf6-portal-typescript-mcp@latest",
        "mcp",
        "--sdk-path",
        "/path/to/bf6-portal-sdk"
      ]
    }
  }
}
```

## MCP Tools

- `search_book`: searches `/content/chapters/*.md` from the installed `link1345/bf-portal-book` data and returns GitHub blob links.
- `get_book_chapter`: returns one chapter by slug with headings and source URL. Chapter text is omitted by default; pass `includeText`, `startLine`, `lineCount`, or `maxChars` for bounded text.
- `search_sdk`: searches SDK docs, type declarations, modlib exports, and FbExportData. Long snippets are truncated and can be expanded with detail/read tools.
- `get_sdk_symbol`: returns parsed SDK type/modlib symbol details. Use `includeDetail` and `maxChars` to control detail size.
- `list_sdk_symbols`: lists lightweight SDK symbol summaries with filters.
- `read_sdk_document`: reads a bounded line range from SDK docs or FbExportData.
- `get_sdk_status`: reports SDK path, detected folders, missing items, and version.

## SDK Layout

The server checks these SDK entries:

- `code/modlib`
- `code/types`
- `docs`
- `FbExportData`
- `sdk.version.json`

Missing entries do not stop startup. They are reported by `get_sdk_status`.

## Publishing

Before publishing to npm:

```bash
npm test
npm run build
npm pack --dry-run
npm publish --access public
```

The package exposes these binary names:

- `bf6-portal-typescript-mcp`
- `bf6-portal-mcp`
