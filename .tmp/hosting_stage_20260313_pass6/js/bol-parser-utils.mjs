function asString(value) {
    if (value === null || value === undefined) return "";
    return typeof value === "string" ? value : String(value);
}

function normalizeWhitespace(value) {
    return asString(value)
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function sanitizeExtractedValue(value, { maxLength = 120, uppercase = false } = {}) {
    const normalized = normalizeWhitespace(value).replace(/\n+/g, " ").trim();
    if (!normalized) return null;

    const cleaned = normalized
        .replace(/^[#:.\-\s]+/, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, maxLength);

    if (!cleaned) return null;
    return uppercase ? cleaned.toUpperCase() : cleaned;
}

function isLikelyFieldLabel(value) {
    const normalized = sanitizeExtractedValue(value, { maxLength: 80, uppercase: true });
    if (!normalized) return true;

    return [
        "SHIPPER",
        "SHIP TO",
        "DELIVER TO",
        "CONSIGNEE",
        "CARRIER",
        "TRACKING",
        "DESCRIPTION",
        "GOODS",
        "WEIGHT",
        "DIMENSIONS",
        "CLASS",
        "PURCHASE ORDER",
        "PO",
        "FROM",
        "TO"
    ].includes(normalized);
}

function getLines(text) {
    return normalizeWhitespace(text)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function extractLabeledValue(text, patterns, options = {}) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const candidate = sanitizeExtractedValue(match[1] || match[0], options);
        if (candidate && !isLikelyFieldLabel(candidate)) {
            return candidate;
        }
    }

    return null;
}

function extractContactBlock(lines, labels) {
    const labelPattern = new RegExp(`^(?:${labels.join("|")})\\b`, "i");
    const stopPattern = /^(?:shipper|ship to|deliver to|consignee|carrier|tracking|description|weight|dimensions?|class|po|purchase order|from|to)\b/i;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!labelPattern.test(line)) continue;

        const directMatch = line.replace(labelPattern, "").replace(/^[:.\s-]+/, "").trim();
        const block = [];
        if (directMatch) block.push(directMatch);

        for (let offset = 1; offset <= 3; offset += 1) {
            const nextLine = lines[index + offset];
            if (!nextLine || stopPattern.test(nextLine)) break;
            block.push(nextLine);
        }

        const filtered = block
            .map((entry) => sanitizeExtractedValue(entry, { maxLength: 120 }))
            .filter((entry) => entry && !isLikelyFieldLabel(entry));

        if (filtered.length > 0) {
            return filtered;
        }
    }

    return [];
}

function extractAddressParts(lines) {
    const normalizedLines = lines
        .map((line) => sanitizeExtractedValue(line, { maxLength: 120 }))
        .filter(Boolean);
    const joined = normalizedLines.join(" ");
    const leadingAddressLabel = /^(?:final destination|destination|ship to|deliver to|consignee|recipient|receiver|to)\s*[:.-]?\s*/i;

    let street = normalizedLines.find((line) => /\d/.test(line) && !/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(line)) || null;
    if (!street) {
        const streetMatch = joined.match(/(\d+[A-Za-z0-9\s.#/-]+?(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|WAY|CT|COURT|PL|PLACE|HWY|HIGHWAY|PKWY|PARKWAY)\b(?:\s+(?:STE|SUITE|APT|UNIT|#)\s*[A-Z0-9-]+)?)/i);
        street = sanitizeExtractedValue(streetMatch?.[1], { maxLength: 120 });
    }

    let cityStateZipMatch = null;
    for (const line of [...normalizedLines].reverse()) {
        const lineCandidate = line
            .replace(street || "", " ")
            .replace(leadingAddressLabel, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        const match = lineCandidate.match(/([A-Za-z][A-Za-z\s.'-]+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
        if (match) {
            cityStateZipMatch = match;
            break;
        }
    }

    if (!cityStateZipMatch) {
        const addressRemainder = (street ? joined.replace(street, " ") : joined)
            .replace(leadingAddressLabel, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        cityStateZipMatch = addressRemainder.match(/([A-Za-z][A-Za-z\s.'-]+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    }

    const city = sanitizeExtractedValue(cityStateZipMatch?.[1], { maxLength: 80 });

    if (street && city) {
        const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        street = street.replace(new RegExp(`\\s+${escapedCity}$`, "i"), "").trim();
    }

    return {
        street,
        city,
        state: sanitizeExtractedValue(cityStateZipMatch?.[2], { maxLength: 2, uppercase: true }),
        zip: sanitizeExtractedValue(cityStateZipMatch?.[3], { maxLength: 10 })
    };
}

function parseQuantity(text, maxCargoItems) {
    const patterns = [
        /(\d+)\s*(?:PALLETS?|PLTS?|SKIDS?)\b/i,
        /(?:PALLETS?|PLTS?|SKIDS?)\s*[:.]?\s*(\d+)/i,
        /(\d+)\s*(?:PIECES?|PCS?|PKGS?|PACKAGES?|CARTONS?|BOXES?|CTN)\b/i,
        /(?:PIECES?|PCS?|PKGS?|QTY|QUANTITY)\s*[:.]?\s*(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const quantity = parseInt(match[1], 10);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity >= 10000) continue;

        const cappedQuantity = Math.min(quantity, maxCargoItems);
        return {
            quantity: cappedQuantity,
            packageType: /PALLET|PLT|SKID/i.test(match[0]) ? "pallet" : "box",
            quantityCapped: quantity > maxCargoItems,
            originalQuantity: quantity > maxCargoItems ? quantity : null
        };
    }

    return {};
}

function parseWeight(text) {
    const patterns = [
        /(?:TOTAL\s*)?(?:GROSS\s*)?WEIGHT\s*[:.]?\s*([\d,]+(?:\.\d+)?)\s*(?:LBS?|POUNDS?|KGS?)\b/i,
        /(\d{2,6}(?:\.\d+)?)\s*(?:LBS?|POUNDS?)\s*(?:TOTAL|GROSS)?\b/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const weight = parseFloat(match[1].replace(/,/g, ""));
        if (Number.isFinite(weight) && weight > 0 && weight < 100000) {
            return weight;
        }
    }

    return null;
}

function parseDimensions(text) {
    const patterns = [
        /(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:IN|INCHES?|")?\b/i,
        /(?:DIMENSIONS?|DIM|SIZE)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const length = parseFloat(match[1]);
        const width = parseFloat(match[2]);
        const height = parseFloat(match[3]);

        if ([length, width, height].every((value) => Number.isFinite(value) && value > 0 && value <= 999)) {
            return { length, width, height };
        }
    }

    return {};
}

function parseTrackingNumber(text) {
    const labeledTracking = extractLabeledValue(text, [
        /(?:TRACKING|TRACK|TRACK #|TRACKING #|PRO|PRO #|PRO NUMBER|TRAILER|SCAC)\s*(?:#|NO\.?|NUMBER)?\s*[:.]?\s*([A-Z0-9-]{6,30})/i
    ], { maxLength: 30, uppercase: true });
    if (labeledTracking) return labeledTracking;

    const upsMatch = text.match(/\b(1Z[A-Z0-9]{16})\b/i);
    if (upsMatch) {
        return sanitizeExtractedValue(upsMatch[1], { maxLength: 18, uppercase: true });
    }

    return null;
}

export function parseBOLText(text, { maxCargoItems = 1000 } = {}) {
    const normalizedText = normalizeWhitespace(text);
    const lines = getLines(normalizedText);
    const data = {};

    const bolNumber = extractLabeledValue(normalizedText, [
        /(?:BOL|B\/L|PRO)\s*(?:#|NO\.?|NUMBER)?\s*[:.]?\s*([A-Z0-9-]{4,30})/i
    ], { maxLength: 30, uppercase: true });
    if (bolNumber) data.bolNumber = bolNumber;

    const poNumber = extractLabeledValue(normalizedText, [
        /(?:PO|P\.O\.?|PURCHASE\s*ORDER)\s*(?:#|NO\.?|NUMBER)?\s*[:.]?\s*([A-Z0-9-]{3,30})/i
    ], { maxLength: 30, uppercase: true });
    if (poNumber) data.poNumber = poNumber;

    const carrier = extractLabeledValue(normalizedText, [
        /(?:CARRIER|TRUCKING|TRANSPORT)\s*(?:NAME)?\s*[:.]?\s*([A-Za-z0-9\s&.-]{3,60}?)(?=\s+(?:TRACKING|TRACK|PRO|WEIGHT|QTY|QUANTITY|DIMENSIONS?|SHIPPER|CONSIGNEE|DESCRIPTION|CLASS)\b|$)/i,
        /(?:SHIPPED\s*(?:VIA|BY))\s*[:.]?\s*([A-Za-z0-9\s&.-]{3,60}?)(?=\s+(?:TRACKING|TRACK|PRO|WEIGHT|QTY|QUANTITY|DIMENSIONS?|SHIPPER|CONSIGNEE|DESCRIPTION|CLASS)\b|$)/i
    ], { maxLength: 60 });
    if (carrier) data.carrier = carrier;

    const trackingNumber = parseTrackingNumber(normalizedText);
    if (trackingNumber) data.trackingNumber = trackingNumber;

    const weight = parseWeight(normalizedText);
    if (weight) data.weight = weight;

    Object.assign(data, parseQuantity(normalizedText, maxCargoItems));
    Object.assign(data, parseDimensions(normalizedText));

    const shipperBlock = extractContactBlock(lines, ["shipper", "ship from", "from", "origin"]);
    if (shipperBlock.length > 0) {
        data.shipperName = sanitizeExtractedValue(shipperBlock[0], { maxLength: 80 });
    }

    const consigneeBlock = extractContactBlock(lines, ["consignee", "ship to", "deliver to", "receiver", "recipient", "to"]);
    if (consigneeBlock.length > 0) {
        data.consigneeName = sanitizeExtractedValue(consigneeBlock[0], { maxLength: 80 });
        const destinationParts = extractAddressParts(consigneeBlock);
        if (destinationParts.street) data.destStreet = destinationParts.street;
        if (destinationParts.city) data.destCity = destinationParts.city;
        if (destinationParts.state) data.destState = destinationParts.state;
        if (destinationParts.zip) data.destZip = destinationParts.zip;
    } else {
        const fallbackAddress = extractAddressParts(lines.slice(-3));
        if (fallbackAddress.city) data.destCity = fallbackAddress.city;
        if (fallbackAddress.state) data.destState = fallbackAddress.state;
        if (fallbackAddress.zip) data.destZip = fallbackAddress.zip;
        if (fallbackAddress.street) data.destStreet = fallbackAddress.street;
    }

    const description = extractLabeledValue(normalizedText, [
        /(?:DESCRIPTION|COMMODITY|GOODS|CONTENTS)\s*(?:OF\s*GOODS?)?\s*[:.]?\s*([A-Za-z0-9\s,./&()-]{5,120}?)(?=\s+(?:CLASS|FREIGHT\s*CLASS|NMFC|WEIGHT|TRACKING|TRACK|QTY|QUANTITY)\b|$)/i
    ], { maxLength: 120 });
    if (description) data.description = description;

    const freightClass = extractLabeledValue(normalizedText, [
        /(?:CLASS|FREIGHT\s*CLASS|NMFC)\s*[:.]?\s*(\d{2,3}(?:\.\d)?)/i
    ], { maxLength: 6 });
    if (freightClass) data.freightClass = freightClass;

    return data;
}
