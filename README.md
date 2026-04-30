# BF6 Portal TypeScript MCP

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

The book path defaults to `/home/link/bf-portal-book`. Override it with `--book-path` when needed.

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

- `search_book`: searches `/content/chapters/*.md` from the local `link1345/bf-portal-book` checkout and returns GitHub blob links.
- `get_book_chapter`: returns one chapter by slug with headings and source URL.
- `search_sdk`: searches SDK docs, type declarations, modlib exports, and FbExportData.
- `get_sdk_symbol`: returns parsed SDK type/modlib symbol details.
- `list_sdk_symbols`: lists parsed SDK symbols with filters.
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
