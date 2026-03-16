"use strict";

const crypto = require("node:crypto");
const logger = require("firebase-functions/logger");

const TRACE_COLLECTION = "shipstation_traces";
const MAX_TAGS = 24;

function cleanString(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength || 200);
}

function cleanOptionalString(value, maxLength) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

function sanitizeTag(value) {
  const cleaned = cleanOptionalString(value, 80);
  if (!cleaned) return null;
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildTag(prefix, value) {
  const cleaned = cleanOptionalString(value, 80);
  if (!cleaned) return null;
  return sanitizeTag(prefix + ":" + cleaned);
}

function normalizeTags(tags) {
  const input = Array.isArray(tags) ? tags : [];
  const seen = new Set();
  const normalized = [];

  for (const tag of input) {
    const cleaned = sanitizeTag(tag);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    normalized.push(cleaned);
    if (normalized.length >= MAX_TAGS) break;
  }

  return normalized;
}

function buildTraceTags(baseTags, fields) {
  const extras = fields || {};
  return normalizeTags([
    ...(Array.isArray(baseTags) ? baseTags : []),
    buildTag("op", extras.operation),
    buildTag("shipment", extras.shipmentId),
    buildTag("tracking", extras.trackingNumber),
    buildTag("ss_shipment", extras.shipstationShipmentId),
    buildTag("ss_v2_shipment", extras.shipstationV2ShipmentId),
    buildTag("ss_label", extras.labelId),
    buildTag("carrier", extras.carrierCode || extras.carrier),
    buildTag("service", extras.serviceCode || extras.service),
    buildTag("resource", extras.resourceType),
    buildTag("status", extras.status),
    buildTag("scope", extras.scope),
  ]);
}

function createTraceId(prefix) {
  const cleanedPrefix = sanitizeTag(prefix || "ss") || "ss";
  return cleanedPrefix + "_" + Date.now().toString(36) + "_" + crypto.randomBytes(4).toString("hex");
}

function normalizeShipmentTagName(value) {
  const cleaned = cleanOptionalString(value, 48);
  if (!cleaned) return null;
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildShipmentTagNames(fields) {
  const input = fields || {};
  return normalizeTags([
    "miami3pl",
    "shipstation",
    normalizeShipmentTagName(input.channel || "portal"),
    normalizeShipmentTagName(input.flowType || "label_purchase"),
    input.warehouse ? normalizeShipmentTagName("warehouse_" + input.warehouse) : null,
    input.carrierCode ? normalizeShipmentTagName("carrier_" + input.carrierCode) : null,
  ]).slice(0, 6);
}

function sanitizeAddress(address) {
  if (!address || typeof address !== "object") return null;

  const output = {};
  const city = cleanOptionalString(
    address.city ||
      address.cityLocality ||
      address.city_locality,
    80,
  );
  const state = cleanOptionalString(
    address.state ||
      address.stateProvince ||
      address.state_province,
    80,
  );
  const postalCode = cleanOptionalString(
    address.postalCode ||
      address.postal_code,
    32,
  );
  const country = cleanOptionalString(
    address.country ||
      address.countryCode ||
      address.country_code,
    8,
  );

  if (city) output.city = city;
  if (state) output.state = state;
  if (postalCode) output.postal_code = postalCode;
  if (country) output.country_code = country;

  return Object.keys(output).length > 0 ? output : null;
}

function parsePath(path) {
  try {
    return new URL(path, "https://api.shipstation.com");
  } catch (error) {
    return null;
  }
}

function summarizeRates(rates) {
  if (!Array.isArray(rates)) return [];
  return rates.slice(0, 5).map((rate) => ({
    service_code: cleanOptionalString(rate.serviceCode || rate.service_code, 80),
    service_name: cleanOptionalString(rate.serviceName || rate.service_name, 120),
    delivery_days: rate.deliveryDays || rate.delivery_days || null,
    shipment_cost: rate.shipmentCost || rate.shipment_cost || null,
    other_cost: rate.otherCost || rate.other_cost || null,
  }));
}

function summarizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.slice(0, 5).map((label) => ({
    label_id: cleanOptionalString(label.label_id || label.labelId, 40),
    shipment_id: cleanOptionalString(label.shipment_id || label.shipmentId, 40),
    tracking_number: cleanOptionalString(label.tracking_number || label.trackingNumber, 120),
    tracking_status: cleanOptionalString(label.tracking_status || label.trackingStatus, 80),
    status: cleanOptionalString(label.status, 80),
  }));
}

function summarizeResourcePayload(payload) {
  if (!payload) return null;

  const shipments = Array.isArray(payload.shipments)
    ? payload.shipments
    : Array.isArray(payload)
      ? payload
      : [payload];

  return {
    shipment_count: shipments.length,
    shipments: shipments.slice(0, 5).map((shipment) => ({
      shipment_id: cleanOptionalString(shipment.shipment_id || shipment.shipmentId, 40),
      tracking_number: cleanOptionalString(shipment.tracking_number || shipment.trackingNumber, 120),
      carrier_code: cleanOptionalString(shipment.carrier_code || shipment.carrierCode, 80),
      service_code: cleanOptionalString(shipment.service_code || shipment.serviceCode, 80),
      voided: Boolean(shipment.voided),
    })),
  };
}

function summarizeShipStationClientRequest(method, path, body) {
  const parsedUrl = parsePath(path);
  const pathname = parsedUrl ? parsedUrl.pathname : cleanString(path, 200);

  if (pathname === "/shipments/getrates") {
    return {
      method: method,
      carrier_code: cleanOptionalString(body && body.carrierCode, 80),
      origin_postal_code: cleanOptionalString(body && body.fromPostalCode, 32),
      destination_postal_code: cleanOptionalString(body && body.toPostalCode, 32),
      destination_state: cleanOptionalString(body && body.toState, 32),
      destination_city: cleanOptionalString(body && body.toCity, 80),
      destination_country: cleanOptionalString(body && body.toCountry, 8),
      weight: body && body.weight ? body.weight : null,
      dimensions: body && body.dimensions ? body.dimensions : null,
      residential: body ? body.residential !== false : null,
    };
  }

  if (pathname === "/shipments/createlabel") {
    return {
      method: method,
      carrier_code: cleanOptionalString(body && body.carrierCode, 80),
      service_code: cleanOptionalString(body && body.serviceCode, 80),
      package_code: cleanOptionalString(body && body.packageCode, 80),
      ship_date: cleanOptionalString(body && body.shipDate, 32),
      test_label: Boolean(body && body.testLabel),
      ship_from: sanitizeAddress(body && body.shipFrom),
      ship_to: sanitizeAddress(body && body.shipTo),
      weight: body && body.weight ? body.weight : null,
      dimensions: body && body.dimensions ? body.dimensions : null,
    };
  }

  if (pathname === "/shipments/voidlabel") {
    return {
      method: method,
      shipment_id: body && body.shipmentId !== undefined ? String(body.shipmentId) : null,
    };
  }

  if (pathname === "/v2/labels") {
    return {
      method: method,
      tracking_number: parsedUrl && parsedUrl.searchParams.get("tracking_number"),
      page: parsedUrl && parsedUrl.searchParams.get("page"),
      page_size: parsedUrl && parsedUrl.searchParams.get("page_size"),
      sort_by: parsedUrl && parsedUrl.searchParams.get("sort_by"),
      sort_dir: parsedUrl && parsedUrl.searchParams.get("sort_dir"),
    };
  }

  if (/^\/v2\/labels\/[^/]+\/track$/.test(pathname)) {
    return {
      method: method,
      label_id: pathname.split("/")[3] || null,
    };
  }

  if (/^\/v2\/labels\/[^/]+\/void$/.test(pathname)) {
    return {
      method: method,
      label_id: pathname.split("/")[3] || null,
    };
  }

  if (/^\/v2\/shipments\/[^/]+\/tags\/[^/]+$/.test(pathname)) {
    return {
      method: method,
      shipment_id: pathname.split("/")[3] || null,
      tag_name: pathname.split("/")[5] || null,
    };
  }

  return {
    method: method,
    path: pathname,
  };
}

function summarizeShipStationClientResponse(path, data) {
  const parsedUrl = parsePath(path);
  const pathname = parsedUrl ? parsedUrl.pathname : cleanString(path, 200);

  if (pathname === "/shipments/getrates") {
    return {
      rate_count: Array.isArray(data) ? data.length : 0,
      sample_rates: summarizeRates(data),
    };
  }

  if (pathname === "/shipments/createlabel") {
    return {
      shipment_id: cleanOptionalString(data && data.shipmentId, 40),
      tracking_number: cleanOptionalString(data && data.trackingNumber, 120),
      shipment_cost: data && data.shipmentCost !== undefined ? data.shipmentCost : null,
      other_cost: data && data.otherCost !== undefined ? data.otherCost : null,
      insurance_cost: data && data.insuranceCost !== undefined ? data.insuranceCost : null,
      label_data_present: Boolean(data && data.labelData),
    };
  }

  if (pathname === "/shipments/voidlabel" || /^\/v2\/labels\/[^/]+\/void$/.test(pathname)) {
    return {
      approved: Boolean(data && data.approved),
      message: cleanOptionalString(data && data.message, 200),
    };
  }

  if (pathname === "/carriers") {
    return {
      carrier_count: Array.isArray(data) ? data.length : 0,
    };
  }

  if (pathname === "/v2/labels") {
    const labels = data && Array.isArray(data.labels) ? data.labels : Array.isArray(data) ? data : [];
    return {
      label_count: labels.length,
      sample_labels: summarizeLabels(labels),
    };
  }

  if (/^\/v2\/labels\/[^/]+\/track$/.test(pathname)) {
    return {
      tracking_number: cleanOptionalString(data && data.tracking_number, 120),
      status_code: cleanOptionalString(data && data.status_code, 80),
      status_description: cleanOptionalString(data && data.status_description, 120),
      estimated_delivery_date: cleanOptionalString(data && data.estimated_delivery_date, 40),
      actual_delivery_date: cleanOptionalString(data && data.actual_delivery_date, 40),
      event_count: data && Array.isArray(data.events) ? data.events.length : 0,
    };
  }

  if (/^\/v2\/shipments\/[^/]+\/tags\/[^/]+$/.test(pathname)) {
    return {
      shipment_id: cleanOptionalString(data && data.shipment_id, 40),
      tag_name:
        cleanOptionalString(data && data.tag && data.tag.name, 80) ||
        cleanOptionalString(data && data.name, 80),
    };
  }

  if (typeof data === "string") {
    return {
      response_type: "string",
      length: data.length,
    };
  }

  if (data && typeof data === "object") {
    return {
      response_type: "object",
      keys: Object.keys(data).slice(0, 12),
      resource_summary: summarizeResourcePayload(data),
    };
  }

  return {
    response_type: typeof data,
  };
}

function sanitizeShipStationError(error) {
  if (!error) return null;
  return {
    message: cleanOptionalString(error.message, 300),
    code:
      error.code !== undefined && error.code !== null
        ? cleanOptionalString(error.code, 80)
        : null,
    name: cleanOptionalString(error.name, 80),
    reset:
      error.reset !== undefined && error.reset !== null
        ? cleanOptionalString(error.reset, 80)
        : null,
    remaining:
      error.remaining !== undefined && error.remaining !== null
        ? cleanOptionalString(error.remaining, 80)
        : null,
  };
}

function buildEntityTraceFields(trace, overrides) {
  const input = overrides || {};
  const at = input.at || new Date().toISOString();
  return {
    shipstation_trace_id: trace ? trace.traceId : null,
    shipstation_trace_tags: trace ? trace.tags : [],
    shipstation_last_operation: input.operation || (trace ? trace.operation : null) || null,
    shipstation_last_trace_status: input.status || null,
    shipstation_last_trace_at: at,
    shipstation_parent_trace_id:
      input.parentTraceId ||
      (trace ? trace.parentTraceId : null) ||
      null,
  };
}

function createTraceRecorder(admin, options) {
  const settings = options || {};
  const FieldValue =
    admin &&
    admin.firestore &&
    admin.firestore.FieldValue
      ? admin.firestore.FieldValue
      : null;
  const traceId = settings.traceId || createTraceId(settings.prefix || "ss");
  const startedAtMs = Date.now();
  const state = {
    traceId: traceId,
    parentTraceId: cleanOptionalString(settings.parentTraceId, 80),
    operation: cleanOptionalString(settings.operation, 80) || "shipstation",
    scope: cleanOptionalString(settings.scope, 80) || "internal",
    userId: cleanOptionalString(settings.userId, 128),
    shipmentId: cleanOptionalString(settings.shipmentId, 128),
    trackingNumber: cleanOptionalString(settings.trackingNumber, 128),
    shipstationShipmentId: cleanOptionalString(settings.shipstationShipmentId, 128),
    shipstationV2ShipmentId: cleanOptionalString(settings.shipstationV2ShipmentId, 128),
    labelId: cleanOptionalString(settings.labelId, 128),
    carrier: cleanOptionalString(settings.carrierCode || settings.carrier, 80),
    service: cleanOptionalString(settings.serviceCode || settings.service, 80),
    resourceType: cleanOptionalString(settings.resourceType, 80),
    status: cleanOptionalString(settings.status, 80),
    tags: buildTraceTags(settings.tags, settings),
  };

  const traceRef =
    admin && typeof admin.firestore === "function"
      ? admin.firestore().collection(TRACE_COLLECTION).doc(traceId)
      : null;

  function getContext() {
    return {
      trace_id: state.traceId,
      parent_trace_id: state.parentTraceId || null,
      operation: state.operation,
      scope: state.scope,
      user_id: state.userId || null,
      shipment_id: state.shipmentId || null,
      tracking_number: state.trackingNumber || null,
      shipstation_shipment_id: state.shipstationShipmentId || null,
      shipstation_v2_shipment_id: state.shipstationV2ShipmentId || null,
      shipstation_label_id: state.labelId || null,
      carrier: state.carrier || null,
      service: state.service || null,
      resource_type: state.resourceType || null,
      tags: state.tags,
    };
  }

  function updateState(fields) {
    if (!fields || typeof fields !== "object") return;

    if (fields.operation) state.operation = cleanOptionalString(fields.operation, 80) || state.operation;
    if (fields.scope) state.scope = cleanOptionalString(fields.scope, 80) || state.scope;
    if (fields.userId || fields.user_id) {
      state.userId = cleanOptionalString(fields.userId || fields.user_id, 128);
    }
    if (fields.shipmentId || fields.shipment_id) {
      state.shipmentId = cleanOptionalString(fields.shipmentId || fields.shipment_id, 128);
    }
    if (fields.trackingNumber || fields.tracking_number) {
      state.trackingNumber = cleanOptionalString(fields.trackingNumber || fields.tracking_number, 128);
    }
    if (fields.shipstationShipmentId || fields.shipstation_shipment_id) {
      state.shipstationShipmentId = cleanOptionalString(
        fields.shipstationShipmentId || fields.shipstation_shipment_id,
        128,
      );
    }
    if (fields.shipstationV2ShipmentId || fields.shipstation_v2_shipment_id) {
      state.shipstationV2ShipmentId = cleanOptionalString(
        fields.shipstationV2ShipmentId || fields.shipstation_v2_shipment_id,
        128,
      );
    }
    if (fields.labelId || fields.shipstation_label_id) {
      state.labelId = cleanOptionalString(fields.labelId || fields.shipstation_label_id, 128);
    }
    if (fields.carrier || fields.carrierCode || fields.carrier_code) {
      state.carrier = cleanOptionalString(
        fields.carrier || fields.carrierCode || fields.carrier_code,
        80,
      );
    }
    if (fields.service || fields.serviceCode || fields.service_code) {
      state.service = cleanOptionalString(
        fields.service || fields.serviceCode || fields.service_code,
        80,
      );
    }
    if (fields.resourceType || fields.resource_type) {
      state.resourceType = cleanOptionalString(fields.resourceType || fields.resource_type, 80);
    }
    if (fields.status) {
      state.status = cleanOptionalString(fields.status, 80);
    }

    state.tags = buildTraceTags(
      [
        ...state.tags,
        ...(Array.isArray(fields.tags) ? fields.tags : []),
      ],
      {
        operation: state.operation,
        shipmentId: state.shipmentId,
        trackingNumber: state.trackingNumber,
        shipstationShipmentId: state.shipstationShipmentId,
        shipstationV2ShipmentId: state.shipstationV2ShipmentId,
        labelId: state.labelId,
        carrier: state.carrier,
        service: state.service,
        resourceType: state.resourceType,
        status: state.status,
        scope: state.scope,
      },
    );
  }

  async function safeMerge(update) {
    if (!traceRef) return;
    try {
      await traceRef.set(update, { merge: true });
    } catch (error) {
      logger.error("ShipStation trace persistence failed", {
        ...getContext(),
        persistence_error: sanitizeShipStationError(error),
      });
    }
  }

  function buildPersistenceBase() {
    return {
      trace_id: state.traceId,
      parent_trace_id: state.parentTraceId || null,
      operation: state.operation,
      scope: state.scope,
      user_id: state.userId || null,
      shipment_id: state.shipmentId || null,
      tracking_number: state.trackingNumber || null,
      shipstation_shipment_id: state.shipstationShipmentId || null,
      shipstation_v2_shipment_id: state.shipstationV2ShipmentId || null,
      shipstation_label_id: state.labelId || null,
      carrier: state.carrier || null,
      service: state.service || null,
      resource_type: state.resourceType || null,
      tags: state.tags,
    };
  }

  async function start(extra) {
    updateState(extra);
    const startedAt = new Date(startedAtMs).toISOString();
    const request = extra && Object.prototype.hasOwnProperty.call(extra, "request")
      ? extra.request
      : settings.request || null;
    const metadata = extra && Object.prototype.hasOwnProperty.call(extra, "metadata")
      ? extra.metadata
      : settings.metadata || null;

    logger.info("ShipStation trace started", {
      ...getContext(),
      request: request,
      metadata: metadata,
    });

    await safeMerge({
      ...buildPersistenceBase(),
      status: "running",
      started_at: startedAt,
      updated_at: startedAt,
      request: request,
      metadata: metadata,
    });
  }

  async function annotate(fields) {
    updateState(fields);
    await safeMerge({
      ...buildPersistenceBase(),
      updated_at: new Date().toISOString(),
    });
  }

  async function event(level, name, details) {
    const logLevel = ["debug", "info", "warn", "error"].includes(level) ? level : "info";
    updateState(details);
    const at = new Date().toISOString();
    const entry = {
      at: at,
      level: logLevel,
      event: cleanString(name, 120),
      details: details || null,
    };

    logger[logLevel]("ShipStation trace event", {
      ...getContext(),
      event: entry.event,
      details: entry.details,
    });

    const update = {
      ...buildPersistenceBase(),
      last_event: entry.event,
      last_event_at: at,
      updated_at: at,
    };

    if (FieldValue) {
      update.events = FieldValue.arrayUnion(entry);
    }

    await safeMerge(update);
  }

  async function success(result) {
    updateState(result);
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    logger.info("ShipStation trace completed", {
      ...getContext(),
      duration_ms: durationMs,
      result: result || null,
    });

    await safeMerge({
      ...buildPersistenceBase(),
      status: "success",
      completed_at: completedAt,
      duration_ms: durationMs,
      updated_at: completedAt,
      result: result || null,
    });
  }

  async function failure(error, details) {
    updateState(details);
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    const sanitizedError = sanitizeShipStationError(error);

    logger.error("ShipStation trace failed", {
      ...getContext(),
      duration_ms: durationMs,
      error: sanitizedError,
      details: details || null,
    });

    await safeMerge({
      ...buildPersistenceBase(),
      status: "error",
      completed_at: completedAt,
      duration_ms: durationMs,
      updated_at: completedAt,
      error: sanitizedError,
      result: details || null,
    });
  }

  function toTraceContext(extra) {
    updateState(extra);
    return {
      traceId: state.traceId,
      parentTraceId: state.parentTraceId || null,
      operation: state.operation,
      scope: state.scope,
      userId: state.userId || null,
      shipmentId: state.shipmentId || null,
      trackingNumber: state.trackingNumber || null,
      shipstationShipmentId: state.shipstationShipmentId || null,
      shipstationV2ShipmentId: state.shipstationV2ShipmentId || null,
      labelId: state.labelId || null,
      carrier: state.carrier || null,
      service: state.service || null,
      resourceType: state.resourceType || null,
      tags: state.tags,
    };
  }

  function child(childOptions) {
    const next = childOptions || {};
    return createTraceRecorder(admin, {
      prefix: next.prefix || settings.prefix || "ss",
      parentTraceId: state.traceId,
      operation: next.operation || state.operation,
      scope: next.scope || state.scope,
      userId: next.userId || next.user_id || state.userId,
      shipmentId: next.shipmentId || next.shipment_id || state.shipmentId,
      trackingNumber: next.trackingNumber || next.tracking_number || state.trackingNumber,
      shipstationShipmentId:
        next.shipstationShipmentId ||
        next.shipstation_shipment_id ||
        state.shipstationShipmentId,
      shipstationV2ShipmentId:
        next.shipstationV2ShipmentId ||
        next.shipstation_v2_shipment_id ||
        state.shipstationV2ShipmentId,
      labelId: next.labelId || next.shipstation_label_id || state.labelId,
      carrier: next.carrier || next.carrierCode || next.carrier_code || state.carrier,
      service: next.service || next.serviceCode || next.service_code || state.service,
      resourceType: next.resourceType || next.resource_type || state.resourceType,
      tags: [
        ...state.tags,
        ...(Array.isArray(next.tags) ? next.tags : []),
      ],
    });
  }

  return {
    traceId: state.traceId,
    parentTraceId: state.parentTraceId,
    operation: state.operation,
    get tags() {
      return state.tags;
    },
    start: start,
    annotate: annotate,
    event: event,
    success: success,
    failure: failure,
    toTraceContext: toTraceContext,
    child: child,
  };
}

module.exports = {
  buildEntityTraceFields: buildEntityTraceFields,
  buildShipmentTagNames: buildShipmentTagNames,
  buildTraceTags: buildTraceTags,
  createTraceId: createTraceId,
  createTraceRecorder: createTraceRecorder,
  normalizeShipmentTagName: normalizeShipmentTagName,
  normalizeTags: normalizeTags,
  sanitizeShipStationError: sanitizeShipStationError,
  summarizeResourcePayload: summarizeResourcePayload,
  summarizeShipStationClientRequest: summarizeShipStationClientRequest,
  summarizeShipStationClientResponse: summarizeShipStationClientResponse,
};
