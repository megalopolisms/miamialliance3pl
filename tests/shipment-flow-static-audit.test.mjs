import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shipmentsHtml = readFileSync(new URL('../portal/shipments.html', import.meta.url), 'utf8');
const adminShipmentsHtml = readFileSync(new URL('../portal/admin-shipments.html', import.meta.url), 'utf8');
const adminPanelHtml = readFileSync(new URL('../portal/admin-panel.html', import.meta.url), 'utf8');
const customersHtml = readFileSync(new URL('../portal/customers.html', import.meta.url), 'utf8');
const inventoryHtml = readFileSync(new URL('../portal/inventory.html', import.meta.url), 'utf8');
const dashboardHtml = readFileSync(new URL('../portal/dashboard.html', import.meta.url), 'utf8');
const pickupsHtml = readFileSync(new URL('../portal/pickups.html', import.meta.url), 'utf8');
const adminPickupsHtml = readFileSync(new URL('../portal/admin-pickups.html', import.meta.url), 'utf8');
const adminBillingHtml = readFileSync(new URL('../portal/admin-billing.html', import.meta.url), 'utf8');
const invoicesHtml = readFileSync(new URL('../portal/invoices.html', import.meta.url), 'utf8');
const storageLogHtml = readFileSync(new URL('../portal/storage-log.html', import.meta.url), 'utf8');
const contactHtml = readFileSync(new URL('../contact.html', import.meta.url), 'utf8');
const firebaseJson = readFileSync(new URL('../firebase.json', import.meta.url), 'utf8');
const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');

test('shipments portal imports shared helpers and storage support', () => {
    assert.match(shipmentsHtml, /firebase-storage\.js/);
    assert.match(shipmentsHtml, /shipments-portal-utils\.mjs/);
    assert.match(shipmentsHtml, /bol-parser-utils\.mjs/);
    assert.match(shipmentsHtml, /const storage = getStorage\(app\);/);
});

test('critical shipment portal buttons keep event handlers wired', () => {
    assert.match(shipmentsHtml, /new-shipment-calc-btn'\)\.addEventListener/);
    assert.match(shipmentsHtml, /add-incoming-item-btn'\)\.addEventListener/);
    assert.match(shipmentsHtml, /sc-create-btn'\)\.addEventListener/);
    assert.match(shipmentsHtml, /bol-auto-fill-btn'\)\.addEventListener/);
    assert.match(shipmentsHtml, /cargo-add-btn'\)\.addEventListener/);
    assert.match(shipmentsHtml, /doc-upload-save-btn'\)\.addEventListener/);
});

test('shipments portal uses resilient load flow and corrected invoice semantics', () => {
    assert.match(shipmentsHtml, /buildShipmentQueryPlan/);
    assert.match(shipmentsHtml, /filterShipmentsForPlan/);
    assert.match(shipmentsHtml, /buildShipmentRowHtml/);
    assert.match(shipmentsHtml, /<option value="processing">Processing<\/option>/);
    assert.match(shipmentsHtml, /doc_type: 'commercial_invoice'/);
    assert.doesNotMatch(shipmentsHtml, /doc_type: 'invoice'/);
    assert.match(shipmentsHtml, /let creationSucceeded = false;/);
    assert.match(shipmentsHtml, /finally \{\s*if \(!creationSucceeded\)/);
});

test('admin document views can resolve URL-backed files without compound query dependence', () => {
    assert.match(adminShipmentsHtml, /pickDocumentSource/);
    assert.match(adminShipmentsHtml, /Unsafe or invalid document link/);
    assert.match(adminShipmentsHtml, /query\(collection\(db, 'shipment_documents'\), where\('shipment_id', '==', shipmentId\)\)/);
    assert.match(adminShipmentsHtml, /data-doc-action="view"/);
    assert.match(adminShipmentsHtml, /data-doc-download="true"/);
    assert.doesNotMatch(adminShipmentsHtml, /panel-doc-btn view" onclick=/);
    assert.doesNotMatch(adminShipmentsHtml, /doc-download-btn" onclick=/);
    assert.match(adminPanelHtml, /pickDocumentSource/);
    assert.match(adminPanelHtml, /url: data\.url \|\| null/);
    assert.match(adminPanelHtml, /url: data\.commercial_invoice\.url \|\| null/);
    assert.match(adminPanelHtml, /rel="noopener noreferrer"/);
});

test('admin panel dynamic actions use data attributes and shared escaping helpers', () => {
    assert.match(adminPanelHtml, /data-shipment-status-id=/);
    assert.match(adminPanelHtml, /data-shipment-view-id=/);
    assert.match(adminPanelHtml, /data-pickup-status-id=/);
    assert.match(adminPanelHtml, /data-pickup-view-id=/);
    assert.match(adminPanelHtml, /data-quote-status-id=/);
    assert.match(adminPanelHtml, /data-quote-view-id=/);
    assert.match(adminPanelHtml, /data-customer-view-id=/);
    assert.match(adminPanelHtml, /data-request-action=/);
    assert.match(adminPanelHtml, /data-delete-task-id=/);
    assert.match(adminPanelHtml, /buildDetailDocumentRow/);
    assert.match(adminPanelHtml, /setBadgeText\(document\.getElementById\('user-name'\)/);
    assert.doesNotMatch(adminPanelHtml, /btn-action btn-view" onclick="viewShipmentDetail/);
    assert.doesNotMatch(adminPanelHtml, /btn-action btn-view" onclick="viewPickupDetail/);
    assert.doesNotMatch(adminPanelHtml, /btn-action btn-view" onclick="viewQuoteDetail/);
    assert.doesNotMatch(adminPanelHtml, /btn-action btn-view" onclick="viewCustomerDetail/);
});

test('customers admin page avoids inline edit handlers and unsafe toast html', () => {
    assert.match(customersHtml, /shipments-portal-utils\.mjs/);
    assert.match(customersHtml, /data-customer-id=/);
    assert.match(customersHtml, /function openEditModal/);
    assert.match(customersHtml, /function closeEditModal/);
    assert.match(customersHtml, /function showToast/);
    assert.match(customersHtml, /window\.showToast = showToast/);
    assert.match(customersHtml, /close-edit-modal-btn/);
    assert.match(customersHtml, /cancel-edit-modal-btn/);
    assert.doesNotMatch(customersHtml, /onclick="openEditModal/);
    assert.doesNotMatch(customersHtml, /toast\.innerHTML/);
});

test('inventory page escapes rendered item content before injecting rows', () => {
    assert.match(inventoryHtml, /shipments-portal-utils\.mjs/);
    assert.match(inventoryHtml, /const safeName = escapeHtml\(item\.name/);
    assert.match(inventoryHtml, /const customerName = escapeHtml\(customersMap\[item\.user_id\] \|\| 'Unknown'\)/);
    assert.match(inventoryHtml, /escapeHtml\(tag\)/);
    assert.match(inventoryHtml, /data-name="\$\{safeName\}"/);
});

test('dashboard uses safe badge rendering and real links for admin cards', () => {
    assert.match(dashboardHtml, /shipments-portal-utils\.mjs/);
    assert.match(dashboardHtml, /setBadgeText\(welcomeTitle/);
    assert.match(dashboardHtml, /setBadgeText\(userNameEl/);
    assert.match(dashboardHtml, /href="customers\.html"/);
    assert.match(dashboardHtml, /encodeURIComponent\(data\.tracking_number \|\| ''\)/);
    assert.doesNotMatch(dashboardHtml, /onclick="location\.href='customers\.html'/);
});

test('contact form reuses the Firebase app and only shows success after persistence', () => {
    assert.match(contactHtml, /getApps\(\)\.length \? appModule\.getApp\(\) : appModule\.initializeApp/);
    assert.match(contactHtml, /trackFormSubmit\('contact_form', false\)/);
    assert.match(contactHtml, /if \(!submitted\) return;/);
    assert.match(contactHtml, /showContactToast\('We could not submit your request/);
});

test('pickup uploads use shared fallback metadata and explicit upload failure handling', () => {
    assert.match(pickupsHtml, /shipments-portal-utils\.mjs/);
    assert.match(pickupsHtml, /buildPickupDocument/);
    assert.match(pickupsHtml, /buildDocumentMetadata/);
    assert.match(pickupsHtml, /getInlineFileData/);
    assert.match(pickupsHtml, /sanitizeStoragePathSegment/);
    assert.match(pickupsHtml, /storage_error:/);
    assert.match(pickupsHtml, /await buildPickupDocument\(uploadedFile, documentType\)/);
    assert.match(pickupsHtml, /submitBtn\?\.addEventListener\('click', submitRequest\)/);
    assert.doesNotMatch(pickupsHtml, /onclick="document\.getElementById\('file-input'\)\.click\(\)"/);
    assert.doesNotMatch(pickupsHtml, /onchange="handleFileSelect\(event\)"/);
});

test('admin pickups resolves safe document sources for uploaded pickup files', () => {
    assert.match(adminPickupsHtml, /pickDocumentSource/);
    assert.match(adminPickupsHtml, /formatPickupDocumentType/);
    assert.match(adminPickupsHtml, /data-request-id=/);
    assert.match(adminPickupsHtml, /data-save-request-id=/);
    assert.match(adminPickupsHtml, /rel="noopener noreferrer"/);
    assert.match(adminPickupsHtml, /pickDocumentSource\(req\.document\)/);
    assert.doesNotMatch(adminPickupsHtml, /action-btn action-btn-view" onclick="openDetail/);
});

test('admin billing uses local function bindings for tab and preview actions', () => {
    assert.match(adminBillingHtml, /function showTab\(tab, tabButton\)/);
    assert.match(adminBillingHtml, /window\.showTab = showTab/);
    assert.match(adminBillingHtml, /function updateCalcPreview\(\)/);
    assert.match(adminBillingHtml, /window\.updateCalcPreview = updateCalcPreview/);
    assert.match(adminBillingHtml, /function loadHistory\(\)/);
    assert.match(adminBillingHtml, /window\.loadHistory = loadHistory/);
    assert.match(adminBillingHtml, /function previewInvoiceActivities\(\)/);
    assert.match(adminBillingHtml, /window\.previewInvoiceActivities = previewInvoiceActivities/);
});

test('invoices page keeps modal and invoice actions bound in module scope', () => {
    assert.match(invoicesHtml, /function loadInvoices\(\)/);
    assert.match(invoicesHtml, /window\.loadInvoices = loadInvoices/);
    assert.match(invoicesHtml, /function closeModal\(id\)/);
    assert.match(invoicesHtml, /window\.closeModal = closeModal/);
    assert.match(invoicesHtml, /function loadCustomerData\(\)/);
    assert.match(invoicesHtml, /window\.calculateInvoice = loadCustomerData/);
    assert.match(invoicesHtml, /function sendInvoice\(\)/);
    assert.match(invoicesHtml, /window\.sendInvoice = sendInvoice/);
});

test('storage log tab actions use explicit button context and local handlers', () => {
    assert.match(storageLogHtml, /onclick="showTab\('record', this\)"/);
    assert.match(storageLogHtml, /function showTab\(tab, tabButton\)/);
    assert.match(storageLogHtml, /window\.showTab = showTab/);
    assert.match(storageLogHtml, /function loadHistory\(\)/);
    assert.match(storageLogHtml, /window\.loadHistory = loadHistory/);
    assert.match(storageLogHtml, /function loadSummary\(\)/);
    assert.match(storageLogHtml, /window\.loadSummary = loadSummary/);
});

test('firebase config includes storage rules for shipment uploads', () => {
    assert.match(firebaseJson, /"storage"\s*:\s*\{\s*"rules"\s*:\s*"storage\.rules"/);
    assert.match(storageRules, /match \/shipment_uploads\/\{userId\}\/\{allPaths=\*\*\}/);
});
