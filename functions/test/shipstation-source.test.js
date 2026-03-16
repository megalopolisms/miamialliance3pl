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
  parseInt,
  parseFloat,
  Promise,
};

[
  "cleanString",
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

  it("builds carrier tracking URLs for USPS, UPS, and FedEx", function () {
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
  });

  it("maps ShipStation tracking payloads into portal shipment statuses", function () {
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({
        status_description: "Delivered",
      }),
      "delivered",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({
        status_description: "Out for delivery",
      }),
      "out_for_delivery",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({
        status_code: "IN_TRANSIT",
      }),
      "in_transit",
    );
    assert.equal(
      sandbox.mapShipStationTrackingToShipmentStatus({
        status_description: "Shipment information sent to carrier",
      }),
      "shipped",
    );
  });
});
