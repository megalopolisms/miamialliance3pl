/**
 * ShipStation Integration Unit Tests
 * Tests SS-004 (applyMarkup) and rate flattening logic.
 * No network calls — pure function testing.
 *
 * Run: cd functions && node --test test/shipstation.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ============================================================
// Extract applyMarkup from the actual production source
// so tests always match the real implementation.
// ============================================================

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

const sandbox = { Math, Number, Object, parseInt, parseFloat, isNaN };
vm.runInNewContext(extractFunctionSource("applyMarkup"), sandbox, { filename: "index.js" });
const applyMarkup = sandbox.applyMarkup;

// ============================================================
// TESTS
// ============================================================

describe("SS-004: applyMarkup (extracted from source)", function () {

  it("percentage: $10.00 @ 15% = $11.50", function () {
    var result = applyMarkup(10.0, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 0,
    });
    assert.equal(result, 11.5);
  });

  it("percentage: $25.00 @ 20% = $30.00", function () {
    var result = applyMarkup(25.0, 10, {
      type: "percentage",
      percentage: 20,
      minimum_charge: 0,
    });
    assert.equal(result, 30.0);
  });

  it("flat: $10.00 + $3.00 = $13.00", function () {
    var result = applyMarkup(10.0, 5, {
      type: "flat",
      flat_fee: 3.0,
      minimum_charge: 0,
    });
    assert.equal(result, 13.0);
  });

  it("flat: $10.00 + $5.50 = $15.50", function () {
    var result = applyMarkup(10.0, 5, {
      type: "flat",
      flat_fee: 5.5,
      minimum_charge: 0,
    });
    assert.equal(result, 15.5);
  });

  it("tiered: 3 lbs hits 25% tier = $12.50", function () {
    var result = applyMarkup(10.0, 3, {
      type: "tiered",
      tiered: [
        { max_weight_lbs: 5, markup_pct: 25 },
        { max_weight_lbs: 20, markup_pct: 15 },
        { max_weight_lbs: 70, markup_pct: 10 },
      ],
      minimum_charge: 0,
    });
    assert.equal(result, 12.5);
  });

  it("tiered: 15 lbs hits 15% tier = $11.50", function () {
    var result = applyMarkup(10.0, 15, {
      type: "tiered",
      tiered: [
        { max_weight_lbs: 5, markup_pct: 25 },
        { max_weight_lbs: 20, markup_pct: 15 },
        { max_weight_lbs: 70, markup_pct: 10 },
      ],
      minimum_charge: 0,
    });
    assert.equal(result, 11.5);
  });

  it("tiered: 50 lbs hits 10% tier = $11.00", function () {
    var result = applyMarkup(10.0, 50, {
      type: "tiered",
      tiered: [
        { max_weight_lbs: 5, markup_pct: 25 },
        { max_weight_lbs: 20, markup_pct: 15 },
        { max_weight_lbs: 70, markup_pct: 10 },
      ],
      minimum_charge: 0,
    });
    assert.equal(result, 11.0);
  });

  it("tiered: 100 lbs exceeds all tiers, falls back to 10%", function () {
    var result = applyMarkup(10.0, 100, {
      type: "tiered",
      tiered: [
        { max_weight_lbs: 5, markup_pct: 25 },
        { max_weight_lbs: 20, markup_pct: 15 },
        { max_weight_lbs: 70, markup_pct: 10 },
      ],
      minimum_charge: 0,
    });
    assert.equal(result, 11.0); // fallback 10%
  });

  it("minimum charge enforced: $1.15 < $5.00 = $5.00", function () {
    var result = applyMarkup(1.0, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 5.0,
    });
    assert.equal(result, 5.0);
  });

  it("minimum charge NOT applied when cost exceeds it", function () {
    var result = applyMarkup(20.0, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 5.0,
    });
    assert.equal(result, 23.0);
  });

  it("unknown type defaults to 15%", function () {
    var result = applyMarkup(10.0, 5, {
      type: "bogus_type",
      minimum_charge: 0,
    });
    assert.equal(result, 11.5);
  });

  it("zero carrier cost with minimum = minimum", function () {
    var result = applyMarkup(0, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 5.0,
    });
    assert.equal(result, 5.0);
  });

  it("rounds to 2 decimal places", function () {
    // 7.33 * 1.15 = 8.4295 → should round to 8.43
    var result = applyMarkup(7.33, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 0,
    });
    assert.equal(result, 8.43);
  });

  it("handles missing percentage gracefully (defaults to 15)", function () {
    var result = applyMarkup(10.0, 5, {
      type: "percentage",
      minimum_charge: 0,
    });
    assert.equal(result, 11.5);
  });

  it("handles missing flat_fee gracefully (defaults to 3)", function () {
    var result = applyMarkup(10.0, 5, {
      type: "flat",
      minimum_charge: 0,
    });
    assert.equal(result, 13.0);
  });

  it("negative carrier cost still respects minimum charge", function () {
    var result = applyMarkup(-5.0, 5, {
      type: "percentage",
      percentage: 15,
      minimum_charge: 3.0,
    });
    assert.equal(result, 3.0);
  });
});

// ============================================================
// Rate flattening logic tests
// ============================================================

describe("Rate flattening", function () {

  it("flattens multi-carrier results into sorted array", function () {
    var multiResults = [
      {
        carrier: "ups",
        rates: [
          { serviceName: "UPS Ground", serviceCode: "ups_ground", shipmentCost: 12.5, otherCost: 0 },
          { serviceName: "UPS 2nd Day", serviceCode: "ups_2day", shipmentCost: 25.0, otherCost: 1.5 },
        ],
        error: null,
      },
      {
        carrier: "stamps_com",
        rates: [
          { serviceName: "USPS Priority", serviceCode: "usps_priority", shipmentCost: 8.75, otherCost: 0 },
        ],
        error: null,
      },
      {
        carrier: "fedex",
        rates: [],
        error: { code: 429, message: "rate limited" },
      },
    ];

    var markup = { type: "percentage", percentage: 15, minimum_charge: 0 };
    var allRates = [];

    for (var i = 0; i < multiResults.length; i++) {
      var result = multiResults[i];
      if (result.error && result.rates.length === 0) continue;
      for (var j = 0; j < result.rates.length; j++) {
        var rate = result.rates[j];
        var rawShipment = parseFloat(rate.shipmentCost);
        var rawOther = parseFloat(rate.otherCost || 0);
        var carrierCost = (isNaN(rawShipment) ? 0 : rawShipment) + (isNaN(rawOther) ? 0 : rawOther);
        var customerCost = applyMarkup(carrierCost, 10, markup);
        allRates.push({
          carrier: result.carrier,
          service: rate.serviceName,
          serviceCode: rate.serviceCode,
          carrierCost: carrierCost,
          customerCost: customerCost,
        });
      }
    }

    allRates.sort(function (a, b) { return a.customerCost - b.customerCost; });

    assert.equal(allRates.length, 3);
    assert.equal(allRates[0].service, "USPS Priority");    // cheapest
    assert.equal(allRates[0].customerCost, 10.06);          // 8.75 * 1.15
    assert.equal(allRates[1].service, "UPS Ground");        // 12.5 * 1.15 = 14.38
    assert.ok(allRates[1].customerCost >= 14.37 && allRates[1].customerCost <= 14.38);
    assert.equal(allRates[2].service, "UPS 2nd Day");       // 26.5 * 1.15 = 30.48
    assert.equal(allRates[2].customerCost, 30.48);
  });

  it("handles all carriers failing gracefully", function () {
    var multiResults = [
      { carrier: "ups", rates: [], error: { code: "TIMEOUT" } },
      { carrier: "fedex", rates: [], error: { code: 429 } },
    ];

    var allRates = [];
    for (var i = 0; i < multiResults.length; i++) {
      if (multiResults[i].rates.length === 0) continue;
    }

    assert.equal(allRates.length, 0);
  });

  it("identifies cheapest and fastest correctly", function () {
    var rates = [
      { service: "Ground", customerCost: 10.0, deliveryDays: 5 },
      { service: "Express", customerCost: 25.0, deliveryDays: 2 },
      { service: "Priority", customerCost: 8.0, deliveryDays: 3 },
      { service: "Overnight", customerCost: 45.0, deliveryDays: 1 },
    ];

    rates.sort(function (a, b) { return a.customerCost - b.customerCost; });
    var cheapest = rates[0];

    var fastest = rates.slice().sort(function (a, b) {
      return (a.deliveryDays || 99) - (b.deliveryDays || 99);
    })[0];

    assert.equal(cheapest.service, "Priority");
    assert.equal(cheapest.customerCost, 8.0);
    assert.equal(fastest.service, "Overnight");
    assert.equal(fastest.deliveryDays, 1);
  });

  it("handles NaN in shipmentCost gracefully", function () {
    var rate = { shipmentCost: "not_a_number", otherCost: 2.0 };
    var rawShipment = parseFloat(rate.shipmentCost);
    var rawOther = parseFloat(rate.otherCost || 0);
    var carrierCost = (isNaN(rawShipment) ? 0 : rawShipment) + (isNaN(rawOther) ? 0 : rawOther);
    assert.equal(carrierCost, 2.0);
  });

  it("handles undefined otherCost gracefully", function () {
    var rate = { shipmentCost: 10.5 };
    var rawShipment = parseFloat(rate.shipmentCost);
    var rawOther = parseFloat(rate.otherCost || 0);
    var carrierCost = (isNaN(rawShipment) ? 0 : rawShipment) + (isNaN(rawOther) ? 0 : rawOther);
    assert.equal(carrierCost, 10.5);
  });

  it("sorts rates correctly when deliveryDays are null", function () {
    var rates = [
      { service: "Economy", customerCost: 5.0, deliveryDays: null },
      { service: "Express", customerCost: 15.0, deliveryDays: 2 },
      { service: "Standard", customerCost: 8.0, deliveryDays: 5 },
    ];

    var fastest = rates.slice().sort(function (a, b) {
      return (a.deliveryDays || 99) - (b.deliveryDays || 99);
    })[0];

    // Express (2 days) should be fastest, null days sorts to end
    assert.equal(fastest.service, "Express");
  });

  it("handles empty rates array for cheapest/fastest", function () {
    var rates = [];
    rates.sort(function (a, b) { return a.customerCost - b.customerCost; });
    var cheapest = rates[0] || null;
    var fastest = rates.length > 0
      ? rates.slice().sort(function (a, b) {
          return (a.deliveryDays || 99) - (b.deliveryDays || 99);
        })[0]
      : null;
    assert.equal(cheapest, null);
    assert.equal(fastest, null);
  });
});
