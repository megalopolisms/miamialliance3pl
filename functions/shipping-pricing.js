"use strict";

const WAREHOUSES = Object.freeze({
  miami: {
    id: "miami",
    name: "Miami Warehouse",
    street: "8780 NW 100th ST",
    city: "Medley",
    state: "FL",
    zip: "33178",
  },
  biloxi: {
    id: "biloxi",
    name: "Biloxi Warehouse",
    street: "1606 Beach Blvd",
    city: "Biloxi",
    state: "MS",
    zip: "39531",
  },
});

const PRICING = Object.freeze({
  dimensionalFactor: 139,
  storagePerCubicFtDay: 0.025,
  handlingFee: 3.5,
  pickAndPack: 1.25,
  palletStoragePerDay: 0.75,
  palletHandling: 15.0,
  palletPickPack: 5.0,
  blackWrapping: 7.0,
  storageDays: 30,
  minStorage: 5.0,
  shippingZones: {
    live: 0,
    local: 0.45,
    regional: 0.65,
    national: 0.85,
    none: 0,
    dropship: 0,
  },
  dropShipRates: {
    envelope: 1.5,
    small: 3.0,
    medium: 5.0,
    large: 20.0,
  },
  fbaPrep: {
    fnskuLabeling: { rate: 0.3, label: "FNSKU Labeling", unit: "unit" },
    polyBagging: { rate: 0.5, label: "Poly Bagging", unit: "unit" },
    bubbleWrapping: { rate: 1.0, label: "Bubble Wrapping", unit: "unit" },
    bundling: { rate: 2.0, label: "Bundling / Kitting", unit: "bundle" },
    boxLabels: { rate: 3.0, label: "Box Content Labels", unit: "box" },
    inspectionQC: { rate: 0.15, label: "Inspection & QC", unit: "unit" },
  },
});

function clampNumber(value, fallback, min, max) {
  let parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    parsed = fallback;
  }
  if (Number.isFinite(min) && parsed < min) {
    parsed = min;
  }
  if (Number.isFinite(max) && parsed > max) {
    parsed = max;
  }
  return parsed;
}

function normalizeZone(zone) {
  return Object.prototype.hasOwnProperty.call(PRICING.shippingZones, zone)
    ? zone
    : "regional";
}

function normalizeDropShipQty(dropShipQty) {
  const input = dropShipQty || {};
  return {
    envelope: clampNumber(input.envelope, 0, 0, 9999),
    small: clampNumber(input.small, 0, 0, 9999),
    medium: clampNumber(input.medium, 0, 0, 9999),
    large: clampNumber(input.large, 0, 0, 9999),
  };
}

function normalizeFbaPrepInput(fbaPrep) {
  const input = fbaPrep || {};
  const result = { enabled: Boolean(input.enabled), services: {} };

  for (const key of Object.keys(PRICING.fbaPrep)) {
    const svc =
      input.services && input.services[key] ? input.services[key] : {};
    result.services[key] = {
      selected: Boolean(svc.selected),
      qty: clampNumber(svc.qty, 0, 0, 99999),
    };
  }

  return result;
}

function normalizeEstimateInput(input) {
  const source = input || {};
  const dimensions = source.dimensions || {};

  return {
    packageType: source.packageType === "pallet" ? "pallet" : "box",
    dimensions: {
      length: clampNumber(dimensions.length, 12, 1, 120),
      width: clampNumber(dimensions.width, 12, 1, 120),
      height: clampNumber(dimensions.height, 12, 1, 120),
    },
    weight: clampNumber(source.weight, 25, 1, 2000),
    quantity: clampNumber(source.quantity, 1, 1, 1000),
    shippingZone: normalizeZone(source.shippingZone || "regional"),
    storageDays: clampNumber(source.storageDays, PRICING.storageDays, 1, 365),
    blackWrapping: Boolean(source.blackWrapping),
    dropShipQty: normalizeDropShipQty(source.dropShipQty),
    fbaPrep: normalizeFbaPrepInput(source.fbaPrep),
  };
}

function getFbaPrepTotal(fbaPrep) {
  if (!fbaPrep || !fbaPrep.enabled) return 0;

  let total = 0;
  for (const key of Object.keys(PRICING.fbaPrep)) {
    const svc = fbaPrep.services[key];
    if (svc && svc.selected && svc.qty > 0) {
      total += svc.qty * PRICING.fbaPrep[key].rate;
    }
  }
  return total;
}

function getCubicFeet(dimensions) {
  return (dimensions.length * dimensions.width * dimensions.height) / 1728;
}

function getDimensionalWeight(dimensions) {
  return (
    (dimensions.length * dimensions.width * dimensions.height) /
    PRICING.dimensionalFactor
  );
}

function getBillableWeight(weight, dimensions) {
  return Math.max(weight, getDimensionalWeight(dimensions));
}

function getDropShipTotal(dropShipQty) {
  let total = 0;
  for (const size of Object.keys(PRICING.dropShipRates)) {
    total += (dropShipQty[size] || 0) * PRICING.dropShipRates[size];
  }
  return total;
}

function getZoneLabel(zone) {
  const labels = {
    live: "Live Carrier Rate",
    local: "Local (Florida)",
    regional: "Regional (Southeast)",
    national: "National",
    none: "No Shipping",
    dropship: "Drop Ship",
  };
  return labels[zone] || zone;
}

function calculateEstimate(input) {
  const config = normalizeEstimateInput(input);
  const cubicFt = getCubicFeet(config.dimensions);
  const dimWeight = getDimensionalWeight(config.dimensions);
  const billableWeight = getBillableWeight(config.weight, config.dimensions);

  let storage = 0;
  let handling = 0;
  let pickPack = 0;
  let shipping = 0;
  let wrapping = 0;
  let dropship = 0;

  if (config.packageType === "pallet") {
    storage =
      PRICING.palletStoragePerDay * config.storageDays * config.quantity;
    handling = PRICING.palletHandling * config.quantity;
    pickPack = PRICING.palletPickPack * config.quantity;
    if (config.shippingZone === "dropship") {
      dropship = getDropShipTotal(config.dropShipQty);
    } else if (config.shippingZone !== "none") {
      shipping =
        billableWeight *
        PRICING.shippingZones[config.shippingZone] *
        config.quantity;
    }
    if (config.blackWrapping) {
      wrapping = PRICING.blackWrapping * config.quantity;
    }
  } else {
    storage =
      cubicFt *
      PRICING.storagePerCubicFtDay *
      config.storageDays *
      config.quantity;
    handling = PRICING.handlingFee * config.quantity;
    pickPack = PRICING.pickAndPack * config.quantity;
    if (config.shippingZone === "dropship") {
      dropship = getDropShipTotal(config.dropShipQty);
    } else if (config.shippingZone !== "none") {
      shipping =
        billableWeight *
        PRICING.shippingZones[config.shippingZone] *
        config.quantity;
    }
  }

  storage = Math.max(storage, PRICING.minStorage);
  const fbaPrepTotal = getFbaPrepTotal(config.fbaPrep);
  const total =
    storage +
    handling +
    pickPack +
    shipping +
    wrapping +
    dropship +
    fbaPrepTotal;

  return {
    packageType: config.packageType,
    dimensions: config.dimensions,
    weight: config.weight,
    quantity: config.quantity,
    shippingZone: config.shippingZone,
    storageDays: config.storageDays,
    blackWrapping: config.blackWrapping,
    dropShipQty: config.dropShipQty,
    fbaPrep: config.fbaPrep,
    cubicFt: cubicFt,
    dimWeight: dimWeight,
    billableWeight: billableWeight,
    storage: storage,
    handling: handling,
    pickPack: pickPack,
    shipping: shipping,
    wrapping: wrapping,
    dropship: dropship,
    fbaPrepTotal: fbaPrepTotal,
    total: total,
  };
}

function getWarehouse(warehouseId) {
  return Object.prototype.hasOwnProperty.call(WAREHOUSES, warehouseId)
    ? WAREHOUSES[warehouseId]
    : WAREHOUSES.miami;
}

function buildWarehouseOrigin(warehouseId) {
  const warehouse = getWarehouse(warehouseId);
  return {
    street: warehouse.street,
    street1: warehouse.street,
    address: warehouse.street,
    city: warehouse.city,
    state: warehouse.state,
    zip: warehouse.zip,
    postalCode: warehouse.zip,
    country: "US",
  };
}

module.exports = {
  PRICING,
  WAREHOUSES,
  calculateEstimate,
  getBillableWeight,
  getCubicFeet,
  getDimensionalWeight,
  getDropShipTotal,
  getFbaPrepTotal,
  getWarehouse,
  getZoneLabel,
  buildWarehouseOrigin,
};
