const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const firestoreRules = fs.readFileSync(
  path.resolve(__dirname, "..", "firestore.rules"),
  "utf8",
);
const storageRules = fs.readFileSync(
  path.resolve(__dirname, "..", "storage.rules"),
  "utf8",
);

assert.match(
  firestoreRules,
  /match \/shipments\/\{shipmentId\} \{[\s\S]*allow create: if isStaff\(\);/m,
  "shipments should not be directly creatable by customer clients",
);
assert.match(
  firestoreRules,
  /ownerCanEditShipmentAttachmentFields\(\)/,
  "shipment owner updates should be restricted to attachment fields",
);
assert.match(
  storageRules,
  /match \/labels\/\{userId\}\/\{shipmentId\}\/\{fileName\}/,
  "label PDFs should be stored under user and shipment scoped paths",
);
assert.match(
  storageRules,
  /match \/pickup_documents\/\{userId\}\/\{allPaths=\*\*\}/,
  "pickup documents should remain readable and writable by the owning user or staff",
);

console.log("security source tests passed");
