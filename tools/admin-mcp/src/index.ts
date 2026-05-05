#!/usr/bin/env node
// Smash Courts Kuwait — Admin MCP server.
//
// Exposes a curated set of admin tools (read + a single safe write) to
// MCP clients like Claude Desktop and Claude Code. The server itself is
// a thin shim: every tool call hits the deployed Vercel admin API
// authenticated with a single bearer token (`ADMIN_MCP_TOKEN`).
//
// Required env vars (set in the MCP client's server config, e.g.
// ~/Library/Application Support/Claude/claude_desktop_config.json):
//
//   SMASH_API_URL    — e.g. https://sport-booking-pi.vercel.app
//   ADMIN_MCP_TOKEN  — same value as on Vercel; matched constant-time
//                      by the Next.js middleware before any handler
//                      runs.
//
// Adding a tool: append an entry to TOOLS, then handle the dispatch
// below. Keep the surface narrow. Money-moving actions (cancel +
// refund, price change) are intentionally NOT exposed here — those
// require an explicit admin session in the browser UI.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = (process.env.SMASH_API_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.ADMIN_MCP_TOKEN ?? "";

if (!API_URL || !TOKEN) {
  console.error(
    "[smash-admin-mcp] Missing required env: SMASH_API_URL and ADMIN_MCP_TOKEN must be set in your MCP client config.",
  );
  process.exit(1);
}

async function api(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

function ok(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function err(status: number, body: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `API returned ${status}: ${JSON.stringify(body)}`,
      },
    ],
  };
}

const TOOLS: Tool[] = [
  {
    name: "today_summary",
    description:
      "Get today's bookings list and stats (total / confirmed / completed / cancelled / revenue today). All times in Kuwait local time.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "week_chart",
    description:
      "Get the last 7 days of booking counts (confirmed and cancelled per day) and per-day revenue. Useful for trend questions.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "total_revenue",
    description:
      "Get total lifetime revenue in KWD across every confirmed and completed booking ever. Cancellations (refunded) are excluded; declined attempts are not counted.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_recent_bookings",
    description:
      "List bookings with filters. Defaults to the next 30 days from today. Filters supported: from/to (Kuwait dates YYYY-MM-DD), status (confirmed | completed | cancelled | all), court_id (UUID), q (search reference / name / phone), page, pageSize.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD (Kuwait date)" },
        to: { type: "string", description: "YYYY-MM-DD (Kuwait date)" },
        status: {
          type: "string",
          enum: ["all", "confirmed", "completed", "cancelled"],
        },
        court_id: { type: "string", description: "Court UUID" },
        q: { type: "string", description: "Search reference / name / phone" },
        page: { type: "integer", minimum: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_booking",
    description:
      "Get a single booking by reference (e.g. BK-2026-ABC12). Returns customer details, court, slot times, status, and payment fields.",
    inputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Booking reference, e.g. BK-2026-ABC12",
        },
      },
      required: ["reference"],
      additionalProperties: false,
    },
  },
  {
    name: "list_courts",
    description:
      "List all courts (active and inactive) with id, name, sport, capacity, price per slot, and is_active flag.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "mark_completed",
    description:
      "Mark a booking as completed (status confirmed → completed). Slot stays booked. Safe write — no refund, no side effects beyond the status flip. Requires the booking to currently be in 'confirmed' status.",
    inputSchema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Booking reference, e.g. BK-2026-ABC12",
        },
      },
      required: ["reference"],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: "smash-courts-admin", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  switch (name) {
    case "today_summary": {
      const r = await api("/api/admin/bookings/today");
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "week_chart": {
      const r = await api("/api/admin/stats/week");
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "total_revenue": {
      const r = await api("/api/admin/stats/total");
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "list_recent_bookings": {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
      }
      const r = await api(
        `/api/admin/bookings${qs.toString() ? `?${qs.toString()}` : ""}`,
      );
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "get_booking": {
      const ref = String(args.reference ?? "");
      if (!ref) return err(400, { error: "missing_reference" });
      const r = await api(`/api/admin/bookings/${encodeURIComponent(ref)}`);
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "list_courts": {
      const r = await api("/api/admin/courts");
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "mark_completed": {
      const ref = String(args.reference ?? "");
      if (!ref) return err(400, { error: "missing_reference" });
      const r = await api(
        `/api/admin/bookings/${encodeURIComponent(ref)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "completed" }),
        },
      );
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    default:
      return err(400, { error: "unknown_tool", name });
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[smash-admin-mcp] ready (stdio)");
