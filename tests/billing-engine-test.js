const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

const BillingEngine = sandbox.MA3PLBillingEngine;

function testQuoteBaselinePreserved() {
  const shipment = {
    id: "ship-1",
    user_id: "cust-1",
    tracking_number: "MA3PL1234",
    package: {
      type: "pallet",
      quantity: 2,
      weight: 100,
      length: 48,
      width: 40,
      height: 60,
      billable_weight: 100,
    },
    shipping_zone: "regional",
    quote_estimate: {
      storage: 45,
      handling: 24,
      pick_pack: 10,
      shipping: 130,
      total: 209,
      storage_days: 30,
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  assert.strictEqual(charges.find((row) => row.key === "storage").amount, 45);
  assert.strictEqual(charges.find((row) => row.key === "handling").amount, 24);
  assert.strictEqual(charges.find((row) => row.key === "pick_pack").amount, 10);
  assert.strictEqual(charges.find((row) => row.key === "shipping").amount, 130);
}

function testAmountAndRateOverrides() {
  const shipment = {
    id: "ship-2",
    user_id: "cust-1",
    tracking_number: "MA3PL5678",
    package: {
      type: "box",
      quantity: 3,
      weight: 15,
      length: 20,
      width: 20,
      height: 20,
      billable_weight: 57.6,
    },
    shipping_zone: "national",
    quote_estimate: {
      storage: 12,
      handling: 10.5,
      pick_pack: 3.75,
      shipping: 146.88,
      total: 173.13,
      storage_days: 30,
    },
    billing_override_detail: {
      shipping: { rate: 1.0 },
      handling: { amount: 30.0 },
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  const shipping = charges.find((row) => row.key === "shipping");
  const handling = charges.find((row) => row.key === "handling");

  assert.strictEqual(shipping.amount, 172.8);
  assert.strictEqual(handling.amount, 30);
}

function testGroupingAndLegacyEvents() {
  const entries = BillingEngine.buildBillableEventEntries([
    {
      id: "evt-1",
      customer_id: "cust-1",
      event_type: "handling",
      description: "Manual Handling",
      quantity: 2,
      unit: "orders",
      rate: 10,
      amount: 25,
      invoiced: false,
    },
    {
      id: "evt-2",
      customer_id: "cust-1",
      event_type: "handling",
      description: "Manual Handling",
      quantity: 1,
      unit: "orders",
      rate: 10,
      amount: 10,
      invoiced: false,
    },
  ]);

  const grouped = BillingEngine.groupInvoiceEntries(entries);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(grouped[0].amount, 35);
  assert.strictEqual(grouped[0].quantity, 3);
}

testQuoteBaselinePreserved();
testAmountAndRateOverrides();
testGroupingAndLegacyEvents();

console.log("billing-engine tests passed");
