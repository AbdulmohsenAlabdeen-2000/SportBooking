# n8n outgoing webhooks

Smash Courts dispatches lifecycle events to a single configurable webhook URL — typically an n8n "Webhook" trigger. Each event is HMAC-signed so the receiver can verify it actually came from your app.

## Events

| Event                | When it fires                                                              |
| -------------------- | -------------------------------------------------------------------------- |
| `booking.confirmed`  | Payment succeeded and booking was just flipped to `confirmed`              |
| `booking.declined`   | Payment was rejected at the gateway; booking written as `declined`         |
| `booking.cancelled`  | Customer or admin cancelled. `cancelled_by` field tells which.             |
| `booking.completed`  | Admin marked a confirmed booking as `completed`                            |
| `court.created`      | A new court was added (active or inactive)                                 |

All five fire **best-effort**. A timeout / 500 / dead URL will be logged but won't take down the user-visible flow that triggered them.

## Wire format

```
POST <N8N_WEBHOOK_URL>
Content-Type: application/json
X-Smash-Event: booking.confirmed
X-Smash-Signature: sha256=<hex digest>
X-Smash-Timestamp: 2026-05-06T10:23:45.123Z

{
  "event": "booking.confirmed",
  "ts": "2026-05-06T10:23:45.123Z",
  "data": { ... event-specific ... }
}
```

`X-Smash-Signature` is `"sha256=" + HMAC_SHA256(N8N_WEBHOOK_SECRET, <raw body>).hex()`.

## Payload shapes

**`booking.confirmed`** — fired alongside the SMS + email confirmation.

```json
{
  "reference": "BK-2026-PL9ZB",
  "customer_name": "Abdulmohsen Alabdeen",
  "customer_phone": "+96594490924",
  "customer_email": "abdul@example.com",
  "court_name": "Padel Court 2",
  "start_time": "2026-05-08T07:00:00+00:00",
  "end_time":   "2026-05-08T08:00:00+00:00",
  "total_price": 8,
  "transaction": {
    "paymentId": "070767...",
    "transactionId": "010401...",
    "referenceId": "06058...",
    "gateway": "VISA",
    "status": "Succss",
    "paidAt": "2026-05-06T10:23:42.000Z"
  }
}
```

**`booking.declined`** — fired when the payment-result page detects a rejected attempt. `transaction` may be null if MyFatoorah didn't return one.

```json
{
  "reference": "BK-2026-WM857",
  "customer_name": "...",
  "customer_phone": "+96594490924",
  "customer_email": null,
  "transaction": { /* same shape as above, or null */ }
}
```

**`booking.cancelled`** — fired after the `cancel_booking` RPC runs. `was_paid: true` means the booking had a successful MyFatoorah charge that triggered a refund; `false` means it was cancelled before payment.

```json
{
  "reference": "BK-2026-PL9ZB",
  "cancelled_by": "customer",
  "was_paid": true,
  "total_price": 8
}
```

**`booking.completed`** — admin-only. Just the reference; pull the full booking via the admin API if you need details.

```json
{ "reference": "BK-2026-PL9ZB" }
```

**`court.created`** — fired from POST `/api/admin/courts` (and from the `create_court` MCP tool, which is the same endpoint).

```json
{
  "id": "e126a6a4-4f57-4c6b-909b-6248205dac9f",
  "name": "CODED Court",
  "sport": "volleyball",
  "capacity": 12,
  "price_per_slot": 10,
  "slot_duration_minutes": 90,
  "is_active": true,
  "image_url": null
}
```

## Setup (5 minutes)

1. **Create the webhook trigger in n8n.** Drop a "Webhook" node, set HTTP method to POST, copy the production URL.

2. **Generate a shared secret.**

    ```sh
    openssl rand -hex 32
    ```

3. **Set both env vars on Vercel.**

    ```sh
    npx vercel env add N8N_WEBHOOK_URL production
    # paste the n8n webhook URL
    npx vercel env add N8N_WEBHOOK_SECRET production
    # paste the secret you generated, mark sensitive: Y
    npx vercel --prod
    ```

4. **Verify the signature in n8n.** Drop a Code node right after the Webhook trigger and paste:

    ```js
    // n8n Code node — language: JavaScript
    const crypto = require('crypto');

    const SECRET = $vars.N8N_WEBHOOK_SECRET; // store in n8n credentials / env
    const presented = $request.headers['x-smash-signature'] || '';
    const expected =
      'sha256=' + crypto.createHmac('sha256', SECRET).update($request.rawBody).digest('hex');

    if (presented.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected))) {
      throw new Error('Invalid signature — request did not come from Smash Courts');
    }

    return $input.all();
    ```

   `$request.rawBody` is the byte-exact body — n8n exposes it on Webhook nodes as long as the trigger's "Raw Body" option is on. Without that, the node parses the JSON and your HMAC won't match.

5. **Branch on event.** After the Code node, add a Switch node keyed on `{{$json.event}}` with one output per event you care about, then build whatever downstream flow you want (Slack, Google Sheets, Twilio fallback, etc.).

## Rotating the secret

1. Generate a new value with `openssl rand -hex 32`.
2. `npx vercel env rm N8N_WEBHOOK_SECRET production` then `npx vercel env add N8N_WEBHOOK_SECRET production` with the new value.
3. Update the same secret in n8n's credentials store / env.
4. `npx vercel --prod` to redeploy.

The two have to match — there's no overlap window. If they're out of sync, the n8n Code node throws and the event is effectively dropped.

## Disabling

Either delete `N8N_WEBHOOK_URL` from Vercel (silent no-op everywhere) or delete `N8N_WEBHOOK_SECRET`. Both vars must be present for the dispatcher to fire; missing either is treated as "not configured".
