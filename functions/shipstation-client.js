/**
 * Miami Alliance 3PL - ShipStation API Client (SS-001)
 * @module shipstation-client
 * @version 2.0.0
 * @description Wraps ShipStation V1 + V2 REST APIs.
 *              Uses Node built-in https — zero npm dependencies.
 *
 * SECTION IDs:
 * - SS-001-A: Authentication
 * - SS-001-B: HTTP Request Wrapper
 * - SS-001-C: Rate Shopping
 * - SS-001-D: Label Operations
 * - SS-001-E: Carrier Management
 */

const https = require("https");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const observability = require("./shipstation-observability");

const V1_BASE_HOST = "ssapi.shipstation.com";
const V2_BASE_HOST = "api.shipstation.com";

function buildTraceLogContext(traceContext) {
  if (!traceContext || typeof traceContext !== "object") {
    return {};
  }

  return {
    trace_id: traceContext.traceId || null,
    parent_trace_id: traceContext.parentTraceId || null,
    operation: traceContext.operation || null,
    shipment_id: traceContext.shipmentId || null,
    tracking_number: traceContext.trackingNumber || null,
    shipstation_shipment_id: traceContext.shipstationShipmentId || null,
    shipstation_v2_shipment_id: traceContext.shipstationV2ShipmentId || null,
    shipstation_label_id: traceContext.labelId || null,
    user_id: traceContext.userId || null,
    tags: Array.isArray(traceContext.tags) ? traceContext.tags : [],
  };
}

function logClientEvent(level, message, traceContext, fields) {
  var payload = Object.assign({}, buildTraceLogContext(traceContext), fields || {});
  var method = ["debug", "info", "warn", "error"].includes(level) ? level : "info";
  logger[method](message, payload);
}

function getRateLimitResetSeconds(headers) {
  if (!headers || typeof headers !== "object") return 60;

  return headers["retry-after"] ||
    headers["x-ratelimit-reset"] ||
    headers["x-rate-limit-reset"] ||
    60;
}

// ============================================================
// SS-001-A: AUTHENTICATION
// ============================================================

/**
 * Build HTTP Basic Auth header from Firebase config.
 * ShipStation uses: Authorization: Basic base64(apiKey:apiSecret)
 * @returns {string} Authorization header value
 * @throws {Error} If credentials not configured
 */
function getAuthHeader() {
  const config = functions.config().shipstation || {};
  const key = config.api_key;
  const secret = config.api_secret;
  if (!key || !secret) {
    throw new Error(
      "ShipStation API credentials not configured. Run: firebase functions:config:set shipstation.api_key=YOUR_KEY shipstation.api_secret=YOUR_SECRET"
    );
  }
  return "Basic " + Buffer.from(key + ":" + secret).toString("base64");
}

function getApiKey() {
  const config = functions.config().shipstation || {};
  const key = config.api_key;
  if (!key) {
    throw new Error(
      "ShipStation API key not configured. Run: firebase functions:config:set shipstation.api_key=YOUR_KEY shipstation.api_secret=YOUR_SECRET"
    );
  }
  return key;
}

// ============================================================
// SS-001-B: HTTP REQUEST WRAPPER
// ============================================================

/**
 * Generic HTTPS request to ShipStation API.
 * Handles JSON serialization, rate limit detection (429), and error parsing.
 *
 * @param {string} method - HTTP method (GET, POST)
 * @param {string} path - API path (e.g., "/shipments/getrates")
 * @param {object|null} body - Request body (POST only)
 * @returns {Promise<{status: number, data: object}>}
 */
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function requestWithRetry(options, body, retries, traceContext) {
  if (retries === undefined) retries = 1;
  return requestWithOptions(options, body, traceContext).catch(function (err) {
    if (retries > 0 && (err.code === 429 || err.code === "TIMEOUT")) {
      var waitMs = err.code === 429
        ? Math.min((parseInt(err.reset, 10) || 2) * 1000, 10000)
        : 1000;
      logClientEvent("warn", "ShipStation API retry scheduled", traceContext, {
        shipstation_host: options.hostname,
        shipstation_path: options.path,
        retry_in_ms: waitMs,
        retries_remaining: retries,
        error: observability.sanitizeShipStationError(err),
      });
      return sleep(waitMs).then(function () {
        return requestWithRetry(options, body, retries - 1, traceContext);
      });
    }
    throw err;
  });
}

function requestWithOptions(options, body, traceContext) {
  var startedAt = Date.now();
  logClientEvent("info", "ShipStation API request started", traceContext, {
    shipstation_host: options.hostname,
    shipstation_path: options.path,
    http_method: options.method,
    request_summary: observability.summarizeShipStationClientRequest(
      options.method,
      options.path,
      body,
    ),
  });

  return new Promise(function (resolve, reject) {
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var durationMs = Date.now() - startedAt;

        // Rate limit detection
        if (res.statusCode === 429) {
          var err429 = new Error("ShipStation rate limit exceeded");
          err429.code = 429;
          err429.reset = getRateLimitResetSeconds(res.headers);
          err429.remaining =
            res.headers["x-ratelimit-remaining"] ||
            res.headers["x-rate-limit-remaining"] ||
            0;
          logClientEvent("warn", "ShipStation API request rate limited", traceContext, {
            shipstation_host: options.hostname,
            shipstation_path: options.path,
            http_method: options.method,
            http_status: res.statusCode,
            duration_ms: durationMs,
            rate_limit_reset: err429.reset,
            rate_limit_remaining: err429.remaining,
          });
          reject(err429);
          return;
        }

        try {
          var parsed = JSON.parse(raw);
          logClientEvent(
            res.statusCode >= 400 ? "warn" : "info",
            "ShipStation API request completed",
            traceContext,
            {
              shipstation_host: options.hostname,
              shipstation_path: options.path,
              http_method: options.method,
              http_status: res.statusCode,
              duration_ms: durationMs,
              response_summary: observability.summarizeShipStationClientResponse(
                options.path,
                parsed,
              ),
            },
          );
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          logClientEvent(
            res.statusCode >= 400 ? "warn" : "info",
            "ShipStation API request completed",
            traceContext,
            {
              shipstation_host: options.hostname,
              shipstation_path: options.path,
              http_method: options.method,
              http_status: res.statusCode,
              duration_ms: durationMs,
              response_summary: observability.summarizeShipStationClientResponse(
                options.path,
                raw,
              ),
            },
          );
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on("error", function (err) {
      var netErr = new Error("ShipStation network error: " + err.message);
      netErr.code = "NETWORK_ERROR";
      netErr.original = err;
      logClientEvent("error", "ShipStation API network error", traceContext, {
        shipstation_host: options.hostname,
        shipstation_path: options.path,
        http_method: options.method,
        duration_ms: Date.now() - startedAt,
        error: observability.sanitizeShipStationError(netErr),
      });
      reject(netErr);
    });

    // Set 30-second timeout
    req.setTimeout(30000, function () {
      req.destroy();
      var timeoutErr = new Error("ShipStation request timed out (30s)");
      timeoutErr.code = "TIMEOUT";
      logClientEvent("error", "ShipStation API timeout", traceContext, {
        shipstation_host: options.hostname,
        shipstation_path: options.path,
        http_method: options.method,
        duration_ms: Date.now() - startedAt,
        error: observability.sanitizeShipStationError(timeoutErr),
      });
      reject(timeoutErr);
    });

    if (body !== null && body !== undefined) {
      var bodyStr = JSON.stringify(body);
      req.setHeader("Content-Length", Buffer.byteLength(bodyStr));
      req.write(bodyStr);
    }
    req.end();
  });
}

function request(method, path, body, traceContext) {
  return requestWithOptions(
    {
      hostname: V1_BASE_HOST,
      path: path,
      method: method,
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    },
    body,
    traceContext,
  );
}

function requestV2(method, path, body, traceContext) {
  return requestWithOptions(
    {
      hostname: V2_BASE_HOST,
      path: path,
      method: method,
      headers: {
        "API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
    },
    body,
    traceContext,
  );
}

function fetchResourceUrl(resourceUrl, traceContext) {
  var parsed = new URL(resourceUrl);
  if (parsed.hostname !== V1_BASE_HOST && parsed.hostname !== V2_BASE_HOST) {
    throw new Error("Unexpected ShipStation resource host: " + parsed.hostname);
  }

  var isV2 = parsed.hostname === V2_BASE_HOST;

  var headers = isV2
    ? { "API-Key": getApiKey(), "Content-Type": "application/json" }
    : { Authorization: getAuthHeader(), "Content-Type": "application/json" };

  return requestWithOptions(
    {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: headers,
    },
    null,
    traceContext,
  );
}

// ============================================================
// SS-001-C: RATE SHOPPING
// ============================================================

/**
 * Get shipping rates for ONE carrier.
 * ShipStation limitation: only one carrierCode per request.
 *
 * @param {object} params - Rate request parameters
 * @param {string} params.carrierCode - e.g., "fedex", "ups", "stamps_com"
 * @param {string} params.fromPostalCode - Origin ZIP
 * @param {string} params.toPostalCode - Destination ZIP
 * @param {string} params.toCountry - Two-letter ISO ("US")
 * @param {object} params.weight - { value: number, units: "pounds"|"ounces" }
 * @param {object} [params.dimensions] - { length, width, height, units: "inches" }
 * @param {string} [params.toState] - Required for UPS
 * @param {string} [params.confirmation] - "none"|"delivery"|"signature"
 * @param {boolean} [params.residential] - Default false
 * @returns {Promise<{status: number, data: Array}>}
 */
function getRates(params, traceContext) {
  return request("POST", "/shipments/getrates", params, traceContext);
}

/**
 * Get rates from MULTIPLE carriers in parallel.
 * Fires one request per carrier simultaneously.
 *
 * @param {string[]} carriers - Array of carrier codes
 * @param {object} baseParams - Shared rate params (without carrierCode)
 * @returns {Promise<Array<{carrier: string, rates: Array|null, error: object|null}>>}
 */
function getRatesMultiCarrier(carriers, baseParams, traceContext) {
  var promises = carriers.map(function (carrierCode) {
    var params = Object.assign({}, baseParams, { carrierCode: carrierCode });
    var carrierTraceContext = traceContext
      ? Object.assign({}, traceContext, {
        carrier: carrierCode,
        tags: observability.normalizeTags(
          (traceContext.tags || []).concat(["carrier:" + carrierCode]),
        ),
      })
      : null;
    return requestWithRetry(
      {
        hostname: V1_BASE_HOST,
        path: "/shipments/getrates",
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      },
      params,
      1,
      carrierTraceContext,
    ).then(function (res) {
        return {
          carrier: carrierCode,
          rates: Array.isArray(res.data) ? res.data : [],
          error: null,
        };
      })
      .catch(function (err) {
        return {
          carrier: carrierCode,
          rates: [],
          error: err,
        };
      });
  });
  return Promise.all(promises);
}

// ============================================================
// SS-001-D: LABEL OPERATIONS
// ============================================================

/**
 * Create a standalone shipping label (purchase postage).
 * Returns tracking number + base64-encoded PDF label.
 *
 * @param {object} params - Label parameters
 * @param {string} params.carrierCode
 * @param {string} params.serviceCode
 * @param {string} params.packageCode - Default "package"
 * @param {string} params.shipDate - ISO date "YYYY-MM-DD"
 * @param {object} params.weight - { value, units }
 * @param {object} params.shipFrom - Address object
 * @param {object} params.shipTo - Address object
 * @param {boolean} [params.testLabel] - USPS only
 * @returns {Promise<{status: number, data: {shipmentId, trackingNumber, shipmentCost, labelData}}>}
 */
function createLabel(params, traceContext) {
  return requestWithRetry(
    {
      hostname: V1_BASE_HOST,
      path: "/shipments/createlabel",
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    },
    params,
    1,
    traceContext,
  );
}

/**
 * Void (cancel) a shipping label.
 *
 * @param {number} shipmentId - ShipStation shipment ID
 * @returns {Promise<{status: number, data: {approved: boolean, message: string}}>}
 */
function voidLabel(shipmentId, traceContext) {
  return requestWithRetry(
    {
      hostname: V1_BASE_HOST,
      path: "/shipments/voidlabel",
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    },
    { shipmentId: shipmentId },
    1,
    traceContext,
  );
}

function voidLabelById(labelId, traceContext) {
  return requestWithRetry(
    {
      hostname: V2_BASE_HOST,
      path: "/v2/labels/" + encodeURIComponent(labelId) + "/void",
      method: "PUT",
      headers: {
        "API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
    },
    null,
    1,
    traceContext,
  );
}

// ============================================================
// SS-001-E: CARRIER MANAGEMENT
// ============================================================

/**
 * List all connected carrier accounts.
 * @returns {Promise<{status: number, data: Array}>}
 */
function listCarriers() {
  return request("GET", "/carriers", null);
}

/**
 * List available services for a carrier.
 * @param {string} carrierCode
 * @returns {Promise<{status: number, data: Array}>}
 */
function listServices(carrierCode) {
  return request("GET", "/carriers/listservices?carrierCode=" + encodeURIComponent(carrierCode), null);
}

/**
 * List package types for a carrier.
 * @param {string} carrierCode
 * @returns {Promise<{status: number, data: Array}>}
 */
function listPackages(carrierCode) {
  return request("GET", "/carriers/listpackages?carrierCode=" + encodeURIComponent(carrierCode), null);
}

function listLabelsByTrackingNumber(trackingNumber, traceContext) {
  return requestV2(
    "GET",
    "/v2/labels?tracking_number=" + encodeURIComponent(trackingNumber) +
      "&page_size=1&sort_by=created_at&sort_dir=desc",
    null,
    traceContext,
  );
}

function getLabelTracking(labelId, traceContext) {
  return requestV2("GET", "/v2/labels/" + encodeURIComponent(labelId) + "/track", null, traceContext);
}

function addShipmentTag(shipmentId, tagName, traceContext) {
  return requestV2(
    "POST",
    "/v2/shipments/" + encodeURIComponent(shipmentId) + "/tags/" + encodeURIComponent(tagName),
    null,
    traceContext,
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getRates: getRates,
  getRatesMultiCarrier: getRatesMultiCarrier,
  createLabel: createLabel,
  voidLabel: voidLabel,
  voidLabelById: voidLabelById,
  listCarriers: listCarriers,
  listServices: listServices,
  listPackages: listPackages,
  listLabelsByTrackingNumber: listLabelsByTrackingNumber,
  getLabelTracking: getLabelTracking,
  addShipmentTag: addShipmentTag,
  fetchResourceUrl: fetchResourceUrl,
  // Exposed for testing
  _getAuthHeader: getAuthHeader,
  _getApiKey: getApiKey,
  _request: request,
  _requestV2: requestV2,
};
