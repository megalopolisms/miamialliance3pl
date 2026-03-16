const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const serverPricing = require("../shipping-pricing");

const sandbox = {
  console,
  window: {},
};
sandbox.window = sandbox;

function loadBrowserQuoteEngine() {
  const browserPath = path.resolve(__dirname, "..", "..", "js", "quote-pricing-engine.js");
  const code = fs.readFileSync(browserPath, "utf8");
  vm.runInNewContext(code, sandbox, { filename: "js/quote-pricing-engine.js" });
  return sandbox.MA3PLQuoteEngine;
}

const browserQuoteEngine = loadBrowserQuoteEngine();

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

describe("shipping-pricing parity", function () {
  const scenarios = [
    {
      name: "regional box shipment",
      input: {
        packageType: "box",
        dimensions: { length: 18, width: 12, height: 10 },
        weight: 8,
        quantity: 2,
        shippingZone: "regional",
        storageDays: 30,
      },
    },
    {
      name: "pallet with black wrapping",
      input: {
        packageType: "pallet",
        dimensions: { length: 48, width: 40, height: 52 },
        weight: 275,
        quantity: 1,
        shippingZone: "local",
        storageDays: 45,
        blackWrapping: true,
      },
    },
    {
      name: "dropship with FBA prep",
      input: {
        packageType: "box",
        dimensions: { length: 16, width: 12, height: 12 },
        weight: 14,
        quantity: 3,
        shippingZone: "dropship",
        storageDays: 30,
        dropShipQty: {
          envelope: 4,
          small: 3,
          medium: 2,
          large: 1,
        },
        fbaPrep: {
          enabled: true,
          services: {
            fnskuLabeling: { selected: true, qty: 20 },
            polyBagging: { selected: true, qty: 12 },
          },
        },
      },
    },
  ];

  scenarios.forEach((scenario) => {
    it(`matches browser engine for ${scenario.name}`, function () {
      const serverEstimate = serverPricing.calculateEstimate(scenario.input);
      const browserEstimate = browserQuoteEngine.calculateEstimate(scenario.input);

      [
        "storage",
        "handling",
        "pickPack",
        "shipping",
        "wrapping",
        "dropship",
        "fbaPrepTotal",
        "total",
        "cubicFt",
        "dimWeight",
        "billableWeight",
      ].forEach((key) => {
        assertClose(serverEstimate[key], browserEstimate[key], key);
      });
    });
  });

  it("builds warehouse origins with the shipment portal schema", function () {
    assert.deepEqual(serverPricing.buildWarehouseOrigin("miami"), {
      street: "8780 NW 100th ST",
      street1: "8780 NW 100th ST",
      address: "8780 NW 100th ST",
      city: "Medley",
      state: "FL",
      zip: "33178",
      postalCode: "33178",
      country: "US",
    });
  });
});
