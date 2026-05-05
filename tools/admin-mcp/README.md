# Smash Courts Admin — MCP Server

Lets you manage Smash Courts Kuwait admin operations from Claude Desktop or Claude Code by speaking to it in plain language. The server is a thin shim that forwards each tool call to the deployed Vercel admin API, authenticated with a single bearer token.

## What it can do

| Tool                   | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `today_summary`        | Today's bookings list and stats (count / confirmed / completed / revenue)     |
| `week_chart`           | Last 7 days of confirmed/cancelled counts and per-day revenue                 |
| `total_revenue`        | Lifetime revenue across every confirmed/completed booking                     |
| `list_recent_bookings` | Search/filter bookings (date range, status, court, free-text)                 |
| `get_booking`          | Single booking by reference (e.g. `BK-2026-ABC12`)                            |
| `list_courts`          | All courts with pricing, capacity, active flag                                |
| `mark_completed`       | Flip a confirmed booking to completed (no refund, no money movement)          |

**Not exposed by design** — cancel-with-refund, court price changes, slot CRUD. Those require the browser admin UI, where you have a real session and can see what you're confirming.

## Setup

### 1. Generate an admin token and put it on Vercel

```sh
openssl rand -hex 32
# copy the output

cd /path/to/Sportsbooking
npx vercel env add ADMIN_MCP_TOKEN production
# paste the value, mark sensitive: Y
npx vercel --prod   # redeploy so the middleware picks it up
```

### 2. Build the server

```sh
cd tools/admin-mcp
npm install
npm run build
```

This produces `tools/admin-mcp/dist/index.js`.

### 3. Wire it into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (create if missing). Add an `mcpServers.smash-admin` entry — keep any existing MCP servers in place:

```json
{
  "mcpServers": {
    "smash-admin": {
      "command": "node",
      "args": [
        "/Users/abdulmohsenalabdeen/Documents/AID Bootcamp Projects/Sportsbooking/tools/admin-mcp/dist/index.js"
      ],
      "env": {
        "SMASH_API_URL": "https://sport-booking-pi.vercel.app",
        "ADMIN_MCP_TOKEN": "<paste-the-same-token-here>"
      }
    }
  }
}
```

Quit Claude Desktop completely (Cmd+Q) and reopen. The tools should appear under the slider/connector menu.

### 3b. Or wire it into Claude Code

Add to `~/.claude/mcp_servers.json`:

```json
{
  "smash-admin": {
    "command": "node",
    "args": [
      "/Users/abdulmohsenalabdeen/Documents/AID Bootcamp Projects/Sportsbooking/tools/admin-mcp/dist/index.js"
    ],
    "env": {
      "SMASH_API_URL": "https://sport-booking-pi.vercel.app",
      "ADMIN_MCP_TOKEN": "<paste-the-same-token-here>"
    }
  }
}
```

Then `/mcp` inside Claude Code should list `smash-admin` with its tools.

### 4. Try it

Ask Claude:

- "What's today's revenue?"
- "How many bookings did we have this week, broken down by status?"
- "Show me bookings for tennis next week."
- "Mark BK-2026-ABC12 as completed."

## Security

- The bearer token is stored both on Vercel (sensitive env var) and in your local Claude config. Treat the local file as you would any other secret — don't commit it, don't share screenshots of it.
- The server uses **stdio** transport — no network port is opened locally. Only the Claude client process you launched can talk to it.
- Server-side auth is constant-time compared in the Next.js middleware before any handler runs. A wrong token gets a generic 401 with no length leak.
- To rotate: generate a new token, replace `ADMIN_MCP_TOKEN` on Vercel, replace it in `claude_desktop_config.json`, redeploy + restart Claude.

## Adding a new tool

1. Append an entry to the `TOOLS` array in `src/index.ts` — name, description, JSON Schema for inputs.
2. Add a `case` in the dispatch switch that maps the tool to an API call.
3. `npm run build` and restart your MCP client.

If the tool needs an admin API endpoint that doesn't exist yet, add it under `src/app/api/admin/` first. The middleware already allows the bearer token through to any `/api/admin/*` route.
