# ShipStation Observability Runbook

Updated: March 16, 2026

This runbook documents the tracing, logging, and tagging added to the Miami Alliance 3PL ShipStation integration.

## Covered flows

- `getShippingRatesLive`
- `purchaseShippingLabel`
- `voidShippingLabel`
- `shipstationWebhook`
- `syncShipmentTracking`
- scheduled `syncCarrierTracking`
- outbound requests in `functions/shipstation-client.js`

## What is now traceable

Each ShipStation operation now gets a `trace_id` and normalized `trace_tags`.

The trace thread is written to:

- `shipstation_traces/{traceId}`
- `shipments.shipstation_trace_id`
- `shipments.shipstation_trace_tags`
- `shipping_quotes.shipstation_trace_id`
- `shipstation_webhooks.trace_id`
- `shipping_financials.trace_id`
- `billable_events.trace_id`

The shipment document is the fastest entry point when tracing an order:

1. Open `shipments/{shipmentId}`
2. Copy `shipstation_trace_id`
3. Open `shipstation_traces/{traceId}`
4. Review `request`, `events`, `result`, and the linked `shipstation_*` ids

## Log fields

Structured logs now include these correlation fields whenever available:

- `trace_id`
- `parent_trace_id`
- `operation`
- `scope`
- `shipment_id`
- `tracking_number`
- `shipstation_shipment_id`
- `shipstation_v2_shipment_id`
- `shipstation_label_id`
- `tags`

The client wrapper also records redacted request and response summaries so Cloud Logging shows:

- which endpoint was called
- which carrier/service was involved
- how long it took
- whether the request hit rate limiting, timeout, or network failure

Full street addresses, auth headers, and base64 label payloads are intentionally excluded from logs.

## Webhook auth

Recommended configuration:

```bash
firebase functions:config:set \
  shipstation.webhook_header_key="x-shipstation-secret" \
  shipstation.webhook_header_value="REPLACE_ME"
```

Backward-compatible fallback:

```bash
firebase functions:config:set shipstation.webhook_secret="REPLACE_ME"
```

Behavior:

- If `shipstation.webhook_header_key` and `shipstation.webhook_header_value` are set, the webhook requires that exact header/value pair.
- Otherwise it accepts either:
  - `?secret=...`
  - `x-shipstation-secret: ...`

## ShipStation tags

On successful label purchase we now:

- compute stable Miami3PL shipment tags locally
- persist requested/applied/failed tag state on the shipment
- add up to 4 tags remotely in ShipStation when a v2 `shipment_id` is available

Current tag family:

- `miami3pl`
- `shipstation`
- `portal`
- `label_purchase`
- `warehouse_*`
- `carrier_*`

Remote tagging is capped to 4 tags per purchase to control API chatter.

## Official ShipStation quirks and optimizations used here

Verified against ShipStation official docs on March 16, 2026:

1. Rate limiting
   Source: https://docs.shipstation.com/rate-limits
   ShipStation allows 200 requests per minute by default and documents the `Retry-After` header for 429 handling.
   Applied here:
   - client retries now honor `Retry-After`
   - remote shipment tagging is capped
   - observability keeps bulk request volume visible

2. Webhook custom headers
   Source: https://docs.shipstation.com/openapi/webhooks
   The webhook create/update schema supports custom headers.
   Applied here:
   - header-based webhook secret validation is supported and preferred over query secrets

3. v2 label voiding is keyed by `label_id`
   Source: https://docs.shipstation.com/void-labels
   ShipStation documents `PUT /v2/labels/{label_id}/void` as the canonical void path.
   Applied here:
   - the void flow now uses `label_id` when available
   - legacy shipment-based void remains as fallback

4. Shipment tags are first-class and auto-create if missing
   Source: https://docs.shipstation.com/tag-shipments
   ShipStation can create missing tags as part of `POST /v2/shipments/{shipment_id}/tags/{tag_name}`.
   Applied here:
   - no separate tag bootstrap step is required
   - shipment tags are attached after label creation when a v2 shipment id is known

5. Tracking is label-centric in v2
   Source: https://docs.shipstation.com/openapi/labels/get_tracking_log_from_label
   Tracking lookup uses `GET /v2/labels/{label_id}/track`.
   Applied here:
   - tracking sync resolves `label_id`, then pulls tracking using that v2 endpoint

6. Rate-shopping and estimate tradeoffs
   Sources:
   - https://docs.shipstation.com/rate-shopping
   - https://docs.shipstation.com/openapi/rates/estimate_rates
   ShipStation distinguishes between:
   - exacter `/v2/rates` calls with validation/service filtering
   - lighter `/v2/rates/estimate` calls with fewer guarantees
   Inference:
   - the current integration should keep authoritative pricing on the full rating path
   - the estimate endpoint is better suited for future anonymous cart previews, not final billing

7. Tracking/webhook coverage is still evolving
   Sources:
   - https://docs.shipstation.com/openapi/webhooks
   - https://docs.shipstation.com/openapi/labels/get_tracking_log_from_label
   Inference:
   - keep scheduled and manual tracking sync enabled even when webhooks are configured
   - do not rely on a single webhook event type as the only source of truth for final order status

## Operational notes

- `shipstation_traces` is backend-written only. Use Firebase Console or admin scripts to inspect it.
- A trace can have child traces. Webhook and scheduler runs create child traces for per-shipment tracking sync.
- If a webhook cannot be processed, the error is also written to `shipstation_webhooks` with `status: "failed"`.
- If label PDF storage fails, label purchase still succeeds and the failure is recorded in the trace.

## Recommended next step

The next major ShipStation optimization should be moving live quoting from the legacy fan-out path toward the v2 `/v2/rates` flow so Miami3PL can use:

- address validation options
- service/package filters
- shipment-id based rate lookup
- bulk rate workflows
