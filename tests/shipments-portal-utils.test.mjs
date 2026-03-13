import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDocumentMetadata,
    buildShipmentQueryPlan,
    buildShipmentRowHtml,
    filterShipmentsForPlan,
    pickDocumentSource,
    sanitizeDocumentSource,
    sanitizeStoragePathSegment
} from '../js/shipments-portal-utils.mjs';

test('buildShipmentQueryPlan avoids status index dependence for customers', () => {
    const plan = buildShipmentQueryPlan({
        isStaffUser: false,
        statusFilter: 'processing',
        currentUserId: 'user-123'
    });

    assert.deepEqual(plan.primary.filters, [['user_id', '==', 'user-123']]);
    assert.deepEqual(plan.primary.orderBy, ['created_at', 'desc']);
    assert.deepEqual(plan.fallback.filters, [['user_id', '==', 'user-123']]);
    assert.equal(plan.clientStatusFilter, 'processing');
});

test('filterShipmentsForPlan sorts newest first and applies client status filter', () => {
    const shipments = [
        { tracking_number: 'A', status: 'delivered', created_at: '2026-03-01T00:00:00.000Z' },
        { tracking_number: 'B', status: 'processing', created_at: '2026-03-03T00:00:00.000Z' },
        { tracking_number: 'C', status: 'processing', created_at: '2026-03-02T00:00:00.000Z' }
    ];

    const filtered = filterShipmentsForPlan(shipments, { clientStatusFilter: 'processing' });

    assert.deepEqual(filtered.map((shipment) => shipment.tracking_number), ['B', 'C']);
});

test('buildShipmentRowHtml escapes values and surfaces tag badges', () => {
    const html = buildShipmentRowHtml({
        tracking_number: 'MA3PL123',
        destination: { name: '<Receiver>', city: 'Miami', state: 'FL' },
        shipping_zone: 'standard',
        status: 'processing',
        created_at: '2026-03-03T00:00:00.000Z',
        incoming_items: [{ tags: ['fragile', '<rush>'] }],
        commercial_invoice: { filename: 'invoice.pdf' }
    }, { includeUploadButton: true, shipmentId: 'shipment-1' });

    assert.match(html, /&lt;Receiver&gt;/);
    assert.match(html, /🏷️ fragile/);
    assert.match(html, /🏷️ &lt;rush&gt;/);
    assert.match(html, /shipment-upload-link/);
});

test('buildDocumentMetadata records storage uploads and strips undefined extras', () => {
    const metadata = buildDocumentMetadata({
        file: { name: 'invoice.pdf', type: 'application/pdf', size: 42 },
        uploadedAt: '2026-03-13T12:00:00.000Z',
        url: 'https://example.com/invoice.pdf',
        storagePath: 'shipment_uploads/u1/s1/invoice.pdf',
        extra: { foo: undefined, po_number: 'PO-1' }
    });

    assert.equal(metadata.upload_method, 'storage');
    assert.equal(metadata.url, 'https://example.com/invoice.pdf');
    assert.equal(metadata.storage_path, 'shipment_uploads/u1/s1/invoice.pdf');
    assert.equal(metadata.po_number, 'PO-1');
    assert.ok(!('foo' in metadata));
});

test('pickDocumentSource prefers safe URL sources and sanitizeStoragePathSegment normalizes filenames', () => {
    assert.equal(
        pickDocumentSource({ url: 'https://example.com/doc.pdf', file_data: 'data:ignored' }, { file_data: 'data:fallback' }),
        'https://example.com/doc.pdf'
    );
    assert.equal(
        pickDocumentSource({ url: 'javascript:alert(1)' }, { file_data: 'data:application/pdf;base64,AAA=' }),
        'data:application/pdf;base64,AAA='
    );
    assert.equal(sanitizeDocumentSource('javascript:alert(1)'), null);
    assert.equal(
        sanitizeStoragePathSegment('Invoice March 2026 #1.pdf'),
        'Invoice-March-2026-1.pdf'
    );
});
