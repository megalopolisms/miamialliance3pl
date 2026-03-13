export const MAX_INLINE_FILE_BYTES = 1024 * 1024;
export const MAX_TAG_BADGES = 3;

function asString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return typeof value === "string" ? value : String(value);
}

export function stripUndefinedValues(value) {
    if (Array.isArray(value)) {
        return value.map(stripUndefinedValues);
    }

    if (value && typeof value === "object" && !(value instanceof Date)) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entryValue]) => entryValue !== undefined)
                .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
        );
    }

    return value;
}

export function escapeHtml(value) {
    return asString(value, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function sanitizeStoragePathSegment(value, fallback = "file") {
    const sanitized = asString(value, fallback)
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);

    return sanitized || fallback;
}

export function normalizeStatusFilter(statusFilter = "all") {
    const normalized = asString(statusFilter, "all").trim().toLowerCase();
    return normalized || "all";
}

export function normalizeShipmentStatus(status) {
    const normalized = asString(status, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    return normalized || "unknown";
}

export function formatShipmentStatus(status) {
    const normalized = normalizeShipmentStatus(status);
    if (normalized === "unknown") return "Unknown";
    return normalized.replace(/_/g, " ");
}

export function parseCreatedAt(createdAt) {
    if (!createdAt) return null;

    if (createdAt instanceof Date) {
        return Number.isNaN(createdAt.getTime()) ? null : createdAt;
    }

    if (typeof createdAt?.toDate === "function") {
        const converted = createdAt.toDate();
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }

    if (typeof createdAt?.seconds === "number") {
        const millis = (createdAt.seconds * 1000) + Math.round((createdAt.nanoseconds || 0) / 1e6);
        const converted = new Date(millis);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }

    const converted = new Date(createdAt);
    return Number.isNaN(converted.getTime()) ? null : converted;
}

export function formatShipmentDate(createdAt, locale = "en-US") {
    const parsed = parseCreatedAt(createdAt);
    return parsed ? parsed.toLocaleDateString(locale) : "—";
}

export function sortShipmentsByCreatedAt(shipments = []) {
    return [...shipments].sort((left, right) => {
        const leftTime = parseCreatedAt(left?.created_at)?.getTime() || 0;
        const rightTime = parseCreatedAt(right?.created_at)?.getTime() || 0;
        return rightTime - leftTime;
    });
}

export function buildShipmentQueryPlan({ isStaffUser = false, statusFilter = "all", currentUserId = null } = {}) {
    const normalizedStatus = normalizeStatusFilter(statusFilter);
    const clientStatusFilter = normalizedStatus === "all" ? null : normalizedStatus;

    if (!isStaffUser && !currentUserId) {
        throw new Error("currentUserId is required for customer shipment queries");
    }

    if (isStaffUser) {
        const filters = clientStatusFilter ? [["status", "==", clientStatusFilter]] : [];
        return {
            primary: {
                filters,
                orderBy: ["created_at", "desc"]
            },
            fallback: {
                filters,
                orderBy: null
            },
            clientStatusFilter: null
        };
    }

    return {
        primary: {
            filters: [["user_id", "==", currentUserId]],
            orderBy: ["created_at", "desc"]
        },
        fallback: {
            filters: [["user_id", "==", currentUserId]],
            orderBy: null
        },
        clientStatusFilter
    };
}

export function filterShipmentsForPlan(shipments = [], plan = {}) {
    const filtered = plan.clientStatusFilter
        ? shipments.filter((shipment) => normalizeShipmentStatus(shipment?.status) === plan.clientStatusFilter)
        : [...shipments];

    return sortShipmentsByCreatedAt(filtered);
}

export function extractShipmentTags(shipment, maxBadges = MAX_TAG_BADGES) {
    const rawItems = Array.isArray(shipment?.incoming_items) ? shipment.incoming_items : [];
    const tags = [];

    for (const item of rawItems) {
        const rawTags = Array.isArray(item?.tags)
            ? item.tags
            : asString(item?.tags, "").split(",");

        for (const tag of rawTags) {
            const normalized = asString(tag, "").trim();
            if (!normalized) continue;
            if (tags.includes(normalized)) continue;
            tags.push(normalized);
        }
    }

    return {
        all: tags,
        visible: tags.slice(0, maxBadges),
        remaining: Math.max(tags.length - maxBadges, 0)
    };
}

function buildDocumentBadgesHtml(shipment, { includeUploadButton = false, shipmentId = null } = {}) {
    let html = "";
    if (shipment?.bol_document) {
        html += '<span style="font-size:0.75rem;background:#eff6ff;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-weight:600;">📄 BOL</span> ';
    }

    const cargoCount = Number(shipment?.cargo_count) || 0;
    if (cargoCount > 0) {
        html += `<span style="font-size:0.75rem;background:#f0fdfa;color:#0d9488;padding:2px 6px;border-radius:4px;font-weight:600;">📦 ${cargoCount} item${cargoCount === 1 ? "" : "s"}</span> `;
    }

    if (shipment?.packing_list) {
        html += '<span style="font-size:0.75rem;background:#f0fdf4;color:#166534;padding:2px 6px;border-radius:4px;font-weight:600;">📋 PL</span> ';
    }

    if (shipment?.commercial_invoice) {
        html += '<span style="font-size:0.75rem;background:#fefce8;color:#854d0e;padding:2px 6px;border-radius:4px;font-weight:600;">🧾 INV</span> ';
    }

    const tagSummary = extractShipmentTags(shipment);
    tagSummary.visible.forEach((tag) => {
        html += `<span style="font-size:0.75rem;background:#f5f3ff;color:#6d28d9;padding:2px 6px;border-radius:4px;font-weight:600;">🏷️ ${escapeHtml(tag)}</span> `;
    });
    if (tagSummary.remaining > 0) {
        html += `<span style="font-size:0.75rem;background:#ede9fe;color:#5b21b6;padding:2px 6px;border-radius:4px;font-weight:600;">+${tagSummary.remaining} tag${tagSummary.remaining === 1 ? "" : "s"}</span> `;
    }

    if (!html) {
        html = '<span style="color:#94a3b8;font-size:0.8rem;">—</span>';
    }

    if (includeUploadButton && shipmentId) {
        const trackingNumber = escapeHtml(shipment?.tracking_number || "");
        html += `<button class="shipment-upload-link" data-shipment-id="${escapeHtml(shipmentId)}" data-tracking="${trackingNumber}" title="Upload shipment documents">📤 Upload</button>`;
    }

    return html;
}

export function buildShipmentRowHtml(shipment, {
    dateLocale = "en-US",
    includeUploadButton = false,
    shipmentId = null
} = {}) {
    const trackingNumber = asString(shipment?.tracking_number, "—");
    const trackingHref = trackingNumber === "—" ? "tracking.html" : `tracking.html?id=${encodeURIComponent(trackingNumber)}`;
    const destinationName = escapeHtml(shipment?.destination?.name || "N/A");
    const destinationCity = escapeHtml(shipment?.destination?.city || "N/A");
    const destinationState = escapeHtml(shipment?.destination?.state || "");
    const service = escapeHtml(shipment?.service_type || shipment?.shipping_zone || "—");
    const statusKey = normalizeShipmentStatus(shipment?.status);
    const statusLabel = escapeHtml(formatShipmentStatus(statusKey));
    const createdLabel = escapeHtml(formatShipmentDate(shipment?.created_at, dateLocale));

    return `
        <td><a href="${trackingHref}" style="color: var(--color-accent); font-weight: 500;">${escapeHtml(trackingNumber)}</a></td>
        <td>${destinationName}</td>
        <td>${destinationCity}, ${destinationState}</td>
        <td>${buildDocumentBadgesHtml(shipment, { includeUploadButton, shipmentId })}</td>
        <td style="text-transform: capitalize;">${service}</td>
        <td><span class="badge badge-${escapeHtml(statusKey)}">${statusLabel}</span></td>
        <td>${createdLabel}</td>
    `;
}

export function getInlineFileData(fileSize, dataUrl, maxInlineBytes = MAX_INLINE_FILE_BYTES) {
    return typeof dataUrl === "string" && Number(fileSize) <= maxInlineBytes ? dataUrl : null;
}

export function pickDocumentSource(...candidates) {
    for (const candidate of candidates) {
        if (!candidate) continue;

        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }

        if (typeof candidate?.url === "string" && candidate.url.trim()) {
            return candidate.url.trim();
        }

        if (typeof candidate?.file_data === "string" && candidate.file_data.trim()) {
            return candidate.file_data.trim();
        }
    }

    return null;
}

export function buildDocumentMetadata({ file, uploadedAt, url = null, storagePath = null, inlineData = null, extra = {} } = {}) {
    if (!file) return null;

    return stripUndefinedValues({
        filename: file.name || null,
        file_type: file.type || null,
        file_size: Number.isFinite(file.size) ? file.size : null,
        uploaded_at: uploadedAt || null,
        ...extra,
        url: url || null,
        storage_path: storagePath || null,
        upload_method: url ? "storage" : inlineData ? "inline" : "metadata_only"
    });
}
