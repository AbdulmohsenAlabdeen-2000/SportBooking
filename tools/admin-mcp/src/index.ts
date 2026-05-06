#!/usr/bin/env node
// Smash Courts Kuwait — Admin MCP server.
//
// Exposes a curated set of admin tools to MCP clients (Claude Desktop /
// Claude Code). Every tool call hits the deployed Vercel admin API
// authenticated with a single bearer token (`ADMIN_MCP_TOKEN`) — same
// token the user puts on Vercel and in their Claude config. From the
// user's perspective there's "no auth" because the token sits in env
// once and works invisibly forever.
//
// Required env vars (set in the MCP client's server config):
//   SMASH_API_URL    — e.g. https://sport-booking-pi.vercel.app
//   ADMIN_MCP_TOKEN  — same value as on Vercel; matched constant-time
//                      in middleware before any handler runs.
//
// Tools (read + a few safe writes):
//   today_summary, week_chart, total_revenue,
//   list_recent_bookings, get_booking, list_courts,
//   mark_completed.
//
// Money-moving actions (cancel + refund, price changes) are
// intentionally NOT exposed — those still go through the browser admin
// UI where you can see what you're confirming.

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
      "Today's bookings list and stats (total / confirmed / completed / cancelled / revenue today). All times in Kuwait local time.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "week_chart",
    description:
      "Last 7 days of booking counts (confirmed and cancelled per day) and per-day revenue.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "total_revenue",
    description:
      "Lifetime revenue in KWD across every confirmed and completed booking ever. Cancellations excluded.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_recent_bookings",
    description:
      "List bookings with filters. Defaults to next 30 days from today. Filters: from/to (YYYY-MM-DD Kuwait), status (confirmed | completed | cancelled | all), court_id (UUID), q (search), page, pageSize.",
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
      "All courts (active and inactive) with id, name, sport, capacity, price per slot, and is_active flag.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_court",
    description:
      "Add a new court to the catalog. When is_active=true (default), the API auto-generates 14 days of open slots so customers can book it immediately. Sport must match one of the supported values; price is in KWD; slot_duration_minutes must be 30, 45, 60, 90, or 120.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Display name, 2–80 characters.",
        },
        sport: {
          type: "string",
          enum: [
            "padel",
            "tennis",
            "football",
            "squash",
            "basketball",
            "volleyball",
            "cricket",
            "pickleball",
            "badminton",
            "futsal",
          ],
        },
        capacity: { type: "integer", minimum: 1, maximum: 100 },
        price_per_slot: { type: "number", minimum: 0 },
        slot_duration_minutes: {
          type: "integer",
          enum: [30, 45, 60, 90, 120],
          description: "Default 60.",
        },
        description: { type: "string", maxLength: 500 },
        image_url: {
          type: "string",
          description: "Public https URL to a court photo.",
        },
        is_active: {
          type: "boolean",
          description:
            "Default true. Inactive courts are hidden from customers and don't get auto-generated slots.",
        },
      },
      required: ["name", "sport", "capacity", "price_per_slot"],
      additionalProperties: false,
    },
  },
  {
    name: "deactivate_court",
    description:
      "Hide a court from customers. Existing bookings stay valid; no new bookings can be created against it.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
      },
      required: ["court_id"],
      additionalProperties: false,
    },
  },
  {
    name: "reactivate_court",
    description:
      "Un-hide a previously deactivated court. Customers can book it again. Does not regenerate slots — those have to be created via the admin slot tools.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
      },
      required: ["court_id"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_completed",
    description:
      "Mark a booking as completed (status confirmed → completed). Slot stays booked. Safe write — no refund, no money movement. Booking must currently be 'confirmed'.",
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
    name: "cancel_booking_with_refund",
    description:
      "DESTRUCTIVE + MOVES MONEY. Cancels a confirmed booking and triggers a full MyFatoorah refund to the original payment method. Slot is released. Use only when the customer should not have to pay (admin-initiated cancellation, double-bookings, weather closures, etc.). Always confirm with the operator before calling — there's no undo.",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Booking reference." },
      },
      required: ["reference"],
      additionalProperties: false,
    },
  },
  {
    name: "get_court",
    description:
      "Single court lookup by UUID. Returns full record including is_active and image_url.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
      },
      required: ["court_id"],
      additionalProperties: false,
    },
  },
  {
    name: "update_court",
    description:
      "Patch any court field. Only the fields you pass are changed; everything else stays as-is. Renaming, repricing, capacity changes, swapping image_url, toggling is_active.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
        name: { type: "string" },
        sport: {
          type: "string",
          enum: [
            "padel",
            "tennis",
            "football",
            "squash",
            "basketball",
            "volleyball",
            "cricket",
            "pickleball",
            "badminton",
            "futsal",
          ],
        },
        capacity: { type: "integer", minimum: 1, maximum: 100 },
        price_per_slot: { type: "number", minimum: 0 },
        slot_duration_minutes: {
          type: "integer",
          enum: [30, 45, 60, 90, 120],
        },
        description: { type: ["string", "null"], maxLength: 500 },
        image_url: { type: ["string", "null"] },
        is_active: { type: "boolean" },
      },
      required: ["court_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_slots",
    description:
      "List slots for a court within a Kuwait-date range. `from`/`to` are inclusive YYYY-MM-DD; the range can't exceed 14 days. Each slot includes status (open/booked/closed) and start/end timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
        from: { type: "string", description: "Kuwait date YYYY-MM-DD." },
        to: { type: "string", description: "Kuwait date YYYY-MM-DD." },
      },
      required: ["court_id", "from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "create_slot",
    description:
      "Create a single custom slot outside the default 8 AM–11 PM window (e.g. a midnight slot for a special event). start_time / end_time are full ISO 8601 timestamps with timezone. 409 if a slot already exists at that exact start.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
        start_time: {
          type: "string",
          description:
            "ISO 8601 with timezone, e.g. 2026-05-10T23:00:00+03:00",
        },
        end_time: {
          type: "string",
          description: "ISO 8601 with timezone, must be after start_time.",
        },
      },
      required: ["court_id", "start_time", "end_time"],
      additionalProperties: false,
    },
  },
  {
    name: "set_slot_status",
    description:
      "Open or close a single slot by ID. Closing a slot hides it from booking; opening makes it available again. Won't change a slot that is already 'booked' (those need to be cancelled via the booking, not the slot).",
    inputSchema: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "Slot UUID." },
        status: { type: "string", enum: ["open", "closed"] },
      },
      required: ["slot_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_slot",
    description:
      "Permanently delete a slot. Only allowed for non-booked slots — use this to clean up stray slots, not to cancel customer bookings.",
    inputSchema: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "Slot UUID." },
      },
      required: ["slot_id"],
      additionalProperties: false,
    },
  },
  {
    name: "bulk_open_slots",
    description:
      "Mark every non-booked slot for a court on a given Kuwait date as 'open'. Useful for un-closing a whole day. Booked slots are left untouched.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
        date: { type: "string", description: "Kuwait date YYYY-MM-DD." },
      },
      required: ["court_id", "date"],
      additionalProperties: false,
    },
  },
  {
    name: "bulk_close_slots",
    description:
      "Mark every non-booked slot for a court on a given Kuwait date as 'closed'. Use for full-day closures (maintenance, public holiday). Booked slots are left untouched — use cancel_booking_with_refund per booking if you also need to clear those.",
    inputSchema: {
      type: "object",
      properties: {
        court_id: { type: "string", description: "Court UUID." },
        date: { type: "string", description: "Kuwait date YYYY-MM-DD." },
      },
      required: ["court_id", "date"],
      additionalProperties: false,
    },
  },
  {
    name: "ensure_slots",
    description:
      "Idempotent slot generator. Fills any gaps in the 14-day rolling window for every active court — 8 AM through 10 PM starts, 60-minute slots, 'open' status. Existing slots are preserved. Same job the daily cron runs; call manually after creating a court late in the day.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
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
    case "create_court": {
      const r = await api("/api/admin/courts", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return r.status === 201 ? ok(r.body) : err(r.status, r.body);
    }
    case "deactivate_court": {
      const id = String(args.court_id ?? "");
      if (!id) return err(400, { error: "missing_court_id" });
      const r = await api(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "reactivate_court": {
      const id = String(args.court_id ?? "");
      if (!id) return err(400, { error: "missing_court_id" });
      const r = await api(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
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
    case "cancel_booking_with_refund": {
      const ref = String(args.reference ?? "");
      if (!ref) return err(400, { error: "missing_reference" });
      const r = await api(
        `/api/admin/bookings/${encodeURIComponent(ref)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        },
      );
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "get_court": {
      const id = String(args.court_id ?? "");
      if (!id) return err(400, { error: "missing_court_id" });
      const r = await api(`/api/admin/courts/${encodeURIComponent(id)}`);
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "update_court": {
      const id = String(args.court_id ?? "");
      if (!id) return err(400, { error: "missing_court_id" });
      const { court_id: _drop, ...patch } = args;
      const r = await api(`/api/admin/courts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "list_slots": {
      const qs = new URLSearchParams();
      for (const k of ["court_id", "from", "to"]) {
        const v = args[k];
        if (v !== undefined) qs.set(k, String(v));
      }
      const r = await api(`/api/admin/slots?${qs.toString()}`);
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "create_slot": {
      const r = await api("/api/admin/slots", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return r.status === 201 ? ok(r.body) : err(r.status, r.body);
    }
    case "set_slot_status": {
      const id = String(args.slot_id ?? "");
      if (!id) return err(400, { error: "missing_slot_id" });
      const r = await api(`/api/admin/slots/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: args.status }),
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "delete_slot": {
      const id = String(args.slot_id ?? "");
      if (!id) return err(400, { error: "missing_slot_id" });
      const r = await api(`/api/admin/slots/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "bulk_open_slots": {
      const r = await api("/api/admin/slots/bulk-open", {
        method: "POST",
        body: JSON.stringify({
          court_id: args.court_id,
          date: args.date,
        }),
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "bulk_close_slots": {
      const r = await api("/api/admin/slots/bulk-close", {
        method: "POST",
        body: JSON.stringify({
          court_id: args.court_id,
          date: args.date,
        }),
      });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    case "ensure_slots": {
      const r = await api("/api/admin/slots/ensure", { method: "POST" });
      return r.status === 200 ? ok(r.body) : err(r.status, r.body);
    }
    default:
      return err(400, { error: "unknown_tool", name });
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[smash-admin-mcp] ready (stdio)");
