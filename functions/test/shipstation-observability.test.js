const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const observability = require("../shipstation-observability");

describe("ShipStation observability helper", function () {
  it("builds normalized trace tags with operation and entity references", function () {
    const tags = observability.buildTraceTags(
      ["ShipStation", "carrier:UPS", "shipstation"],
      {
        operation: "Label Purchase",
        shipmentId: "ship_123",
        trackingNumber: "1Z999",
        carrierCode: "UPS",
      },
    );

    assert.ok(tags.includes("shipstation"));
    assert.ok(tags.includes("carrier:ups"));
    assert.ok(tags.includes("op:label_purchase"));
    assert.ok(tags.includes("shipment:ship_123"));
    assert.ok(tags.includes("tracking:1z999"));
  });

  it("summarizes create-label requests without exposing street lines", function () {
    const summary = observability.summarizeShipStationClientRequest(
      "POST",
      "/shipments/createlabel",
      {
        carrierCode: "ups",
        serviceCode: "ups_ground",
        shipFrom: {
          street1: "8780 NW 100th ST",
          city: "Medley",
          state: "FL",
          postalCode: "33178",
          country: "US",
        },
        shipTo: {
          street1: "123 Main Street",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "US",
        },
      },
    );

    assert.equal(summary.carrier_code, "ups");
    assert.deepEqual(summary.ship_from, {
      city: "Medley",
      state: "FL",
      postal_code: "33178",
      country_code: "US",
    });
    assert.deepEqual(summary.ship_to, {
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country_code: "US",
    });
    assert.equal(summary.ship_to.street1, undefined);
  });

  it("summarizes label responses without leaking base64 payloads", function () {
    const summary = observability.summarizeShipStationClientResponse(
      "/shipments/createlabel",
      {
        shipmentId: 12345,
        trackingNumber: "1Z999AA10123456784",
        shipmentCost: 11.23,
        labelData: "JVBERi0xLjQKJ...",
      },
    );

    assert.equal(summary.shipment_id, "12345");
    assert.equal(summary.tracking_number, "1Z999AA10123456784");
    assert.equal(summary.shipment_cost, 11.23);
    assert.equal(summary.label_data_present, true);
    assert.equal(summary.labelData, undefined);
  });

  it("builds stable shipment tags for outbound labels", function () {
    const tags = observability.buildShipmentTagNames({
      channel: "Portal",
      flowType: "Label Purchase",
      warehouse: "Miami",
      carrierCode: "UPS",
    });

    assert.deepEqual(tags, [
      "miami3pl",
      "shipstation",
      "portal",
      "label_purchase",
      "warehouse_miami",
      "carrier_ups",
    ]);
  });
});
