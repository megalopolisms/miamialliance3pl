const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(__dirname, "..", "index.js");
const source = fs.readFileSync(sourcePath, "utf8");

function extractFunctionSource(name) {
  const patterns = ["async function " + name + "(", "function " + name + "("];
  let start = -1;

  for (const pattern of patterns) {
    start = source.indexOf(pattern);
    if (start !== -1) break;
  }

  if (start === -1) {
    throw new Error("Function not found in source: " + name);
  }

  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) {
    throw new Error("Function body not found in source: " + name);
  }

  let depth = 0;
  let mode = "code";

  for (let i = bodyStart; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (mode === "line_comment") {
      if (char === "\n") mode = "code";
      continue;
    }

    if (mode === "block_comment") {
      if (prev === "*" && char === "/") mode = "code";
      continue;
    }

    if (mode === "single_quote") {
      if (char === "'" && prev !== "\\") mode = "code";
      continue;
    }

    if (mode === "double_quote") {
      if (char === "\"" && prev !== "\\") mode = "code";
      continue;
    }

    if (mode === "template") {
      if (char === "`" && prev !== "\\") mode = "code";
      continue;
    }

    if (char === "/" && next === "/") {
      mode = "line_comment";
      continue;
    }

    if (char === "/" && next === "*") {
      mode = "block_comment";
      continue;
    }

    if (char === "'") {
      mode = "single_quote";
      continue;
    }

    if (char === "\"") {
      mode = "double_quote";
      continue;
    }

    if (char === "`") {
      mode = "template";
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error("Failed to extract function source: " + name);
}

const sandbox = {
  Math,
  Number,
  Object,
  String,
  Boolean,
  Date,
  Array,
  parseInt,
  parseFloat,
  isNaN,
  Promise,
  encodeURIComponent,
  // STATUS_RANK is a const, not a function — inject directly
  STATUS_RANK: {
    pending: 0, shipped: 1, in_transit: 2, out_for_delivery: 3,
    delivered: 4, returned: 5, exception: 5, voided: 5,
  },
};

[
  "cleanString",
  "cleanOptionalString",
  "roundCurrency",
  "buildPortalTrackingNumber",
  "normalizePortalDestination",
  "isStaffRole",
  "canAdvanceStatus",
  "getZoneFromZip",
  "toolGetShippingRates",
  "normalizeLegacyRateResponse",
  "buildLegacyRateFallbackResponse",
  "buildCarrierTrackingUrl",
  "mapShipStationTrackingToShipmentStatus",
].forEach((name) => {
  vm.runInNewContext(extractFunctionSource(name), sandbox, { filename: "index.js" });
});

describe("ShipStation source helpers", function () {
  it("builds simulated fallback rates for customer callers without internal margin fields", async function () {
    const result = await sandbox.buildLegacyRateFallbackResponse(
      { weight_lbs: 5, destination_zip: "10001" },
      false,
    );

    assert.equal(result.source, "simulated");
    assert.equal(result.count, 3);
    assert.equal(result.markup, null);
    assert.equal(result.rates.length, 3);
    assert.equal(result.cheapest.carrier, "fedex");
    assert.equal(result.fastest.days, 5);

    result.rates.forEach((rate) => {
      assert.equal(Object.prototype.hasOwnProperty.call(rate, "carrierCost"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(rate, "margin"), false);
      assert.equal(typeof rate.customerCost, "number");
    });
  });

  it("builds simulated fallback rates for admin callers with internal cost fields intact", async function () {
    const result = await sandbox.buildLegacyRateFallbackResponse(
      { weight_lbs: 5, destination_zip: "10001" },
      true,
    );

    assert.equal(result.source, "simulated");
    assert.equal(result.origin.city, "Medley");
    assert.equal(result.origin.state, "FL");
    assert.equal(result.origin.zip, "33178");
    assert.equal(result.rates.length, 3);
    assert.equal(result.rates[0].carrier, "fedex");
    assert.equal(result.rates[0].carrierCost, result.rates[0].customerCost);
    assert.equal(result.rates[0].margin, 0);
  });

  it("builds carrier tracking URLs for USPS, UPS, FedEx, DHL, and OnTrac", function () {
    assert.equal(
      sandbox.buildCarrierTrackingUrl("stamps_com", "9400111899223856929134"),
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223856929134",
    );
    assert.equal(
      sandbox.buildCarrierTrackingUrl("ups", "1Z999AA10123456784"),
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    );
    assert.equal(
      sandbox.buildCarrierTrackingUrl("fedex", "123456789012"),
      "https://www.fedex.com/fedextrack/?trknbr=123456789012",
    );
    assert.equal(
      sandbox.buildCarrierTrackingUrl("dhl_express", "1234567890"),
      "https://www.dhl.com/en/express/tracking.html?AWB=1234567890",
    );
    assert.equal(
      sandbox.buildCarrierTrackingUrl("ontrac", "D100000001"),
      "https://www.ontrac.com/tracking/?number=D100000001",
    );
    // Empty for unknown carrier
    assert.equal(sandbox.buildCarrierTrackingUrl("unknown_carrier", "ABC123"), "");
    // Empty for missing inputs
    assert.equal(sandbox.buildCarrierTrackingUrl(null, "ABC123"), "");
    assert.equal(sandbox.buildCarrierTrackingUrl("ups", null), "");
  });

  it("maps ShipStation tracking payloads into portal shipment statuses", function () {
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Delivered" }),
      "delivered",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Out for delivery" }),
      "out_for_delivery",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_code: "IN_TRANSIT" }),
      "in_transit",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Shipment information sent to carrier" }),
      "shipped",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Label created" }),
      "shipped",
    );
    // New: exception and return statuses
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_code: "RETURN_TO_SENDER" }),
      "returned",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Return to sender" }),
      "returned",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_code: "EXCEPTION" }),
      "exception",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Undeliverable" }),
      "exception",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "Refused by recipient" }),
      "exception",
    );
    // Unknown status returns null
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({ status_description: "some unknown thing" }),
      null,
    );
  });
});

describe("Utility helpers (extracted from source)", function () {
  it("cleanString trims and truncates", function () {
    assert.equal(sandbox.cleanString("  hello world  ", 5), "hello");
    assert.equal(sandbox.cleanString("", 10), "");
    assert.equal(sandbox.cleanString(null, 10), "");
    assert.equal(sandbox.cleanString(undefined, 10), "");
    assert.equal(sandbox.cleanString("test"), "test");
  });

  it("cleanOptionalString returns null for empty", function () {
    assert.equal(sandbox.cleanOptionalString(""), null);
    assert.equal(sandbox.cleanOptionalString(null), null);
    assert.equal(sandbox.cleanOptionalString("hello"), "hello");
  });

  it("roundCurrency rounds to 2 decimal places", function () {
    assert.equal(sandbox.roundCurrency(10.555), 10.56);
    assert.equal(sandbox.roundCurrency(10.554), 10.55);
    assert.equal(sandbox.roundCurrency(0), 0);
    assert.equal(sandbox.roundCurrency("12.345"), 12.35);
    assert.equal(sandbox.roundCurrency(null), 0);
    assert.equal(sandbox.roundCurrency(undefined), 0);
    assert.equal(sandbox.roundCurrency("not_a_number"), 0);
  });

  it("buildPortalTrackingNumber sanitizes input or generates fallback", function () {
    assert.equal(sandbox.buildPortalTrackingNumber("1Z-ABC-123"), "1Z-ABC-123");
    assert.equal(sandbox.buildPortalTrackingNumber("track#@!456"), "TRACK456");
    // Fallback generates MA3PL prefix
    const fallback = sandbox.buildPortalTrackingNumber("");
    assert.ok(fallback.startsWith("MA3PL"));
    assert.ok(fallback.length > 5);
  });

  it("normalizePortalDestination handles missing fields", function () {
    const result = sandbox.normalizePortalDestination({});
    assert.equal(result.name, "Customer");
    assert.equal(result.country, "US");
    assert.equal(result.street, "");

    const full = sandbox.normalizePortalDestination({
      name: "Jane Doe",
      street1: "123 Main St",
      city: "Miami",
      state: "fl",
      zip: "33178",
    });
    assert.equal(full.name, "Jane Doe");
    assert.equal(full.street1, "123 Main St");
    assert.equal(full.state, "FL");
    assert.equal(full.zip, "33178");
  });

  it("isStaffRole identifies admin and employee", function () {
    assert.equal(sandbox.isStaffRole("admin"), true);
    assert.equal(sandbox.isStaffRole("employee"), true);
    assert.equal(sandbox.isStaffRole("customer"), false);
    assert.equal(sandbox.isStaffRole(null), false);
    assert.equal(sandbox.isStaffRole(undefined), false);
  });

  it("canAdvanceStatus prevents status downgrades", function () {
    // Forward transitions
    assert.equal(sandbox.canAdvanceStatus("pending", "shipped"), true);
    assert.equal(sandbox.canAdvanceStatus("shipped", "in_transit"), true);
    assert.equal(sandbox.canAdvanceStatus("in_transit", "out_for_delivery"), true);
    assert.equal(sandbox.canAdvanceStatus("out_for_delivery", "delivered"), true);

    // Backward transitions blocked
    assert.equal(sandbox.canAdvanceStatus("delivered", "shipped"), false);
    assert.equal(sandbox.canAdvanceStatus("in_transit", "shipped"), false);
    assert.equal(sandbox.canAdvanceStatus("delivered", "in_transit"), false);

    // Same status blocked
    assert.equal(sandbox.canAdvanceStatus("shipped", "shipped"), false);

    // Terminal statuses always allowed
    assert.equal(sandbox.canAdvanceStatus("delivered", "voided"), true);
    assert.equal(sandbox.canAdvanceStatus("in_transit", "returned"), true);
    assert.equal(sandbox.canAdvanceStatus("shipped", "exception"), true);

    // Null new status blocked
    assert.equal(sandbox.canAdvanceStatus("pending", null), false);
    assert.equal(sandbox.canAdvanceStatus("pending", undefined), false);
  });
});
