# Smash Courts Admin — MCP Server

Lets you control the booking system from Claude Desktop or Claude Code by speaking to it in plain language. The server is a thin shim that forwards each tool call to the deployed Vercel admin API, authenticated by a single bearer token configured once.

From your perspective: zero authentication during use — the token sits in env, Claude calls it transparently.

## Tools

| Tool                   | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `today_summary`        | Today's bookings list and stats (count / confirmed / completed / revenue)     |
| `week_chart`           | Last 7 days of confirmed/cancelled counts and per-day revenue                 |
| `total_revenue`        | Lifetime revenue across every confirmed/completed booking                     |
| `list_recent_bookings` | Search/filter bookings (date range, status, court, free-text)                 |
| `get_booking`          | Single booking by reference (e.g. `BK-2026-ABC12`)                            |
| `list_courts`          | All courts with pricing, capacity, active flag                                |
| `mark_completed`       | Flip a confirmed booking to completed (no refund, no money movement)          |

**Not exposed by design** — cancel-with-refund, court price changes, slot CRUD. Those still require the browser admin UI where you can see what you're confirming.

## One-time setup (5 minutes)

### 1. Generate an admin token + put it on Vercel

```sh
openssl rand -hex 32
# copy the output

cd /path/to/Sportsbooking
npx vercel env add ADMIN_MCP_TOKEN production
# paste the value, mark sensitive: Y
npx vercel --prod
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

Quit Claude Desktop completely (Cmd+Q) and reopen. Tools will appear under the slider/connector menu.

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

## Try it

Ask Claude:

- "What's today's revenue?"
- "How many bookings did we have this week, broken down by status?"
- "Show me bookings for tennis next week."
- "Mark BK-2026-ABC12 as completed."

## How it works

The MCP server runs locally on your machine via stdio — only your Claude Desktop / Code process can talk to it. It calls the Vercel admin API with `Authorization: Bearer <token>`. The Next.js middleware does a constant-time compare of that token against `ADMIN_MCP_TOKEN`; on match, the request bypasses the Supabase cookie session and the admin handler runs normally.

That bearer-token bypass is the only "different" code path — everything downstream (handlers, RLS, Supabase queries) is the same as a browser admin request.

## Security

- The token is stored on Vercel (sensitive env var) and in your local Claude config. Treat the local file like any other secret — don't commit it.
- The server uses **stdio** transport — no network port is opened locally.
- The middleware bearer-token compare uses a length-checked XOR loop (Edge-runtime safe — no `node:crypto`).
- To rotate: generate a new token, replace `ADMIN_MCP_TOKEN` on Vercel, replace it in `claude_desktop_config.json`, redeploy + restart Claude.

## Adding a new tool

1. Append an entry to the `TOOLS` array in `src/index.ts` — name, description, JSON Schema for inputs.
2. Add a `case` in the dispatch switch that maps the tool to an API call.
3. `npm run build` and restart your MCP client.

If the tool needs an admin API endpoint that doesn't exist yet, add it under `src/app/api/admin/` first. The middleware already lets the bearer token through to any `/api/admin/*` route.
