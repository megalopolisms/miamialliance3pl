/**
 * Shared quote pricing engine.
 * Keeps shipment wizard and free quote calculator aligned on structure/rates.
 */
(function (global) {
  "use strict";

  var PRICING = Object.freeze({
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
    var parsed = Number(value);
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
    var input = dropShipQty || {};
    return {
      envelope: clampNumber(input.envelope, 0, 0, 9999),
      small: clampNumber(input.small, 0, 0, 9999),
      medium: clampNumber(input.medium, 0, 0, 9999),
      large: clampNumber(input.large, 0, 0, 9999),
    };
  }

  function normalizeEstimateInput(input) {
    var source = input || {};
    var dimensions = source.dimensions || {};
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

  function normalizeFbaPrepInput(fbaPrep) {
    var input = fbaPrep || {};
    var result = { enabled: Boolean(input.enabled), services: {} };
    var services = PRICING.fbaPrep;
    for (var key in services) {
      if (Object.prototype.hasOwnProperty.call(services, key)) {
        var svc =
          input.services && input.services[key] ? input.services[key] : {};
        result.services[key] = {
          selected: Boolean(svc.selected),
          qty: clampNumber(svc.qty, 0, 0, 99999),
        };
      }
    }
    return result;
  }

  function getFbaPrepTotal(fbaPrep) {
    if (!fbaPrep || !fbaPrep.enabled) return 0;
    var total = 0;
    var services = PRICING.fbaPrep;
    for (var key in services) {
      if (Object.prototype.hasOwnProperty.call(services, key)) {
        var svc = fbaPrep.services[key];
        if (svc && svc.selected && svc.qty > 0) {
          total += svc.qty * services[key].rate;
        }
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
    var total = 0;
    var rates = PRICING.dropShipRates;
    for (var size in rates) {
      if (Object.prototype.hasOwnProperty.call(rates, size)) {
        total += (dropShipQty[size] || 0) * rates[size];
      }
    }
    return total;
  }

  function getZoneLabel(zone) {
    var labels = {
      local: "Local (Florida)",
      regional: "Regional (Southeast)",
      national: "National",
      none: "No Shipping",
      dropship: "Drop Ship",
    };
    return labels[zone] || zone;
  }

  function calculateEstimate(input) {
    var config = normalizeEstimateInput(input);
    var cubicFt = getCubicFeet(config.dimensions);
    var dimWeight = getDimensionalWeight(config.dimensions);
    var billableWeight = getBillableWeight(config.weight, config.dimensions);

    var storage = 0;
    var handling = 0;
    var pickPack = 0;
    var shipping = 0;
    var wrapping = 0;
    var dropship = 0;

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
    var fbaPrepTotal = getFbaPrepTotal(config.fbaPrep);
    var total =
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

  global.MA3PLQuoteEngine = {
    PRICING: PRICING,
    getCubicFeet: getCubicFeet,
    getDimensionalWeight: getDimensionalWeight,
    getBillableWeight: getBillableWeight,
    getDropShipTotal: getDropShipTotal,
    getFbaPrepTotal: getFbaPrepTotal,
    getZoneLabel: getZoneLabel,
    calculateEstimate: calculateEstimate,
  };
})(window);
