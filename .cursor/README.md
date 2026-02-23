# MCP (Model Context Protocol) configuration

## Browser MCP

This project configures a **Playwright** browser MCP server so the AI can automate the browser (navigate, snapshot, click, type, etc.).

- **Config:** `.cursor/mcp.json` registers the `playwright` server.
- **After changing MCP config:** Fully restart Cursor (quit and reopen) so servers reload.

## If the built-in “Cursor IDE Browser” shows no tools

The Cursor IDE Browser (e.g. `cursor-ide-browser`) is separate from the Playwright server above. If it appears in the MCP list but shows no tools:

1. Open **Cursor Settings** (`Ctrl+,`) → **Tools & MCP**.
2. Find the browser-related server (e.g. “Cursor IDE Browser” or “cursor-ide-browser”).
3. Ensure it is **enabled** and has a valid **command** (or remove it and rely on Playwright).
4. Restart Cursor.

The **Playwright** server above should work without extra steps as long as Node.js is installed and you restart Cursor after editing `mcp.json`.
