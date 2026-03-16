const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const portalPath = path.resolve(__dirname, "..", "portal", "shipments.html");
const trackingPath = path.resolve(__dirname, "..", "portal", "tracking.html");
const portalSource = fs.readFileSync(portalPath, "utf8");
const trackingSource = fs.readFileSync(trackingPath, "utf8");

assert.match(
  portalSource,
  /httpsCallable\(fns,\s*'createPortalShipment'\)/,
  "shipments portal should use createPortalShipment callable",
);
assert.doesNotMatch(
  portalSource,
  /addDoc\(collection\(db,\s*'shipments'\)/,
  "shipments portal should not create shipment docs directly from the browser",
);
assert.match(
  portalSource,
  /httpsCallable\(fns,\s*'getShipmentLabel'\)/,
  "shipments portal should support stored label downloads",
);
assert.match(
  trackingSource,
  /httpsCallable\(fns,\s*'getShipmentLabel'\)/,
  "tracking portal should support stored label downloads",
);

console.log("portal shipment source tests passed");
