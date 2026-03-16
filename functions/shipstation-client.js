/**
 * Miami Alliance 3PL - ShipStation API Client (SS-001)
 * @module shipstation-client
 * @version 1.0.0
 * @description Wraps ShipStation V1 REST API with Basic Auth.
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

const V1_BASE_HOST = "ssapi.shipstation.com";
const V2_BASE_HOST = "api.shipstation.com";

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

function requestWithRetry(options, body, retries) {
  if (retries === undefined) retries = 1;
  return requestWithOptions(options, body).catch(function (err) {
    if (err.code === 429 && retries > 0) {
      var waitMs = Math.min((parseInt(err.reset, 10) || 2) * 1000, 10000);
      console.warn("ShipStation 429 - retrying in " + waitMs + "ms");
      return sleep(waitMs).then(function () {
        return requestWithRetry(options, body, retries - 1);
      });
    }
    throw err;
  });
}

function requestWithOptions(options, body) {
  return new Promise(function (resolve, reject) {
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");

        // Rate limit detection
        if (res.statusCode === 429) {
          var err429 = new Error("ShipStation rate limit exceeded");
          err429.code = 429;
          err429.reset = res.headers["x-rate-limit-reset"] || 60;
          err429.remaining = res.headers["x-rate-limit-remaining"] || 0;
          reject(err429);
          return;
        }

        try {
          var parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on("error", function (err) {
      var netErr = new Error("ShipStation network error: " + err.message);
      netErr.code = "NETWORK_ERROR";
      netErr.original = err;
      reject(netErr);
    });

    // Set 30-second timeout
    req.setTimeout(30000, function () {
      req.destroy();
      var timeoutErr = new Error("ShipStation request timed out (30s)");
      timeoutErr.code = "TIMEOUT";
      reject(timeoutErr);
    });

    if (body !== null && body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function request(method, path, body) {
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
  );
}

function requestV2(method, path, body) {
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
  );
}

function fetchResourceUrl(resourceUrl) {
  var parsed = new URL(resourceUrl);
  if (parsed.hostname !== V1_BASE_HOST) {
    throw new Error("Unexpected ShipStation resource host: " + parsed.hostname);
  }

  return requestWithOptions(
    {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    },
    null,
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
function getRates(params) {
  return request("POST", "/shipments/getrates", params);
}

/**
 * Get rates from MULTIPLE carriers in parallel.
 * Fires one request per carrier simultaneously.
 *
 * @param {string[]} carriers - Array of carrier codes
 * @param {object} baseParams - Shared rate params (without carrierCode)
 * @returns {Promise<Array<{carrier: string, rates: Array|null, error: object|null}>>}
 */
function getRatesMultiCarrier(carriers, baseParams) {
  var promises = carriers.map(function (carrierCode) {
    var params = Object.assign({}, baseParams, { carrierCode: carrierCode });
    return request("POST", "/shipments/getrates", params)
      .then(function (res) {
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
function createLabel(params) {
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
  );
}

/**
 * Void (cancel) a shipping label.
 *
 * @param {number} shipmentId - ShipStation shipment ID
 * @returns {Promise<{status: number, data: {approved: boolean, message: string}}>}
 */
function voidLabel(shipmentId) {
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

function listLabelsByTrackingNumber(trackingNumber) {
  return requestV2(
    "GET",
    "/v2/labels?tracking_number=" + encodeURIComponent(trackingNumber) +
      "&page_size=1&sort_by=created_at&sort_dir=desc",
    null,
  );
}

function getLabelTracking(labelId) {
  return requestV2("GET", "/v2/labels/" + encodeURIComponent(labelId) + "/track", null);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getRates: getRates,
  getRatesMultiCarrier: getRatesMultiCarrier,
  createLabel: createLabel,
  voidLabel: voidLabel,
  listCarriers: listCarriers,
  listServices: listServices,
  listPackages: listPackages,
  listLabelsByTrackingNumber: listLabelsByTrackingNumber,
  getLabelTracking: getLabelTracking,
  fetchResourceUrl: fetchResourceUrl,
  // Exposed for testing
  _getAuthHeader: getAuthHeader,
  _getApiKey: getApiKey,
  _request: request,
  _requestV2: requestV2,
};
