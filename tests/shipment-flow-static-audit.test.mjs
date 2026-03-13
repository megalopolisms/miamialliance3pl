import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shipmentsHtml = readFileSync(new URL('../portal/shipments.html', import.meta.url), 'utf8');
const adminShipmentsHtml = readFileSync(new URL('../portal/admin-shipments.html', import.meta.url), 'utf8');
const adminPanelHtml = readFileSync(new URL('../portal/admin-panel.html', import.meta.url), 'utf8');
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
    assert.match(adminShipmentsHtml, /query\(collection\(db, 'shipment_documents'\), where\('shipment_id', '==', shipmentId\)\)/);
    assert.match(adminPanelHtml, /url: data\.url \|\| null/);
    assert.match(adminPanelHtml, /url: data\.commercial_invoice\.url \|\| null/);
});

test('firebase config includes storage rules for shipment uploads', () => {
    assert.match(firebaseJson, /"storage"\s*:\s*\{\s*"rules"\s*:\s*"storage\.rules"/);
    assert.match(storageRules, /match \/shipment_uploads\/\{userId\}\/\{allPaths=\*\*\}/);
});
