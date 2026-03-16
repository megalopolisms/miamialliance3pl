const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = {
  console,
  window: {},
};
sandbox.window = sandbox;

function loadScript(relPath) {
  const filePath = path.resolve(__dirname, "..", relPath);
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInNewContext(code, sandbox, { filename: relPath });
}

loadScript("js/quote-pricing-engine.js");
loadScript("js/billing-engine.js");

const QuoteEngine = sandbox.MA3PLQuoteEngine;
const BillingEngine = sandbox.MA3PLBillingEngine;

function testLiveZoneLabel() {
  assert.equal(QuoteEngine.getZoneLabel("live"), "Live Carrier Rate");
}

function testLiveZoneBaselineQuoteEngineBehavior() {
  const estimate = QuoteEngine.calculateEstimate({
    packageType: "box",
    dimensions: { length: 18, width: 12, height: 10 },
    weight: 8,
    quantity: 2,
    shippingZone: "live",
    storageDays: 30,
  });

  assert.equal(estimate.shippingZone, "live");
  assert.equal(estimate.shipping, 0);
  assert.ok(estimate.total > 0);
}

function testBillingEngineHonorsLiveQuoteShippingTotal() {
  const shipment = {
    id: "ship-live-1",
    user_id: "cust-live-1",
    tracking_number: "MA3PLLIVE1",
    package: {
      type: "box",
      quantity: 2,
      weight: 8,
      length: 18,
      width: 12,
      height: 10,
      billable_weight: 8,
    },
    shipping_zone: "live",
    quote_estimate: {
      storage: 18,
      handling: 7,
      pick_pack: 2.5,
      shipping: 31.98,
      total: 59.48,
      storage_days: 30,
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  const shipping = charges.find((row) => row.key === "shipping");
  assert.ok(shipping, "expected shipping charge to exist");
  assert.equal(shipping.amount, 31.98);
  assert.equal(shipping.quoteAmount, 31.98);
}

testLiveZoneLabel();
testLiveZoneBaselineQuoteEngineBehavior();
testBillingEngineHonorsLiveQuoteShippingTotal();

console.log("live-shipping pricing tests passed");
