import test from 'node:test';
import assert from 'node:assert/strict';

import { parseBOLText } from '../js/bol-parser-utils.mjs';

test('parseBOLText extracts labeled shipment details from structured text', () => {
    const parsed = parseBOLText(`
        BILL OF LADING
        BOL #: BOL-7788
        PO Number: PO-42
        Carrier: Southeastern Freight
        Tracking #: 1Z999AA10123456784
        Weight: 1,240 LBS
        Qty: 4 pallets
        Dimensions: 48 x 40 x 60
        Shipper:
        ACME Supply
        100 Origin Ave
        Dallas, TX 75201
        Consignee:
        Naim Dahdah
        8780 NW 100th ST
        Medley, FL 33178
        Description of Goods: Collagen supplements
        Freight Class: 85
    `, { maxCargoItems: 1000 });

    assert.equal(parsed.bolNumber, 'BOL-7788');
    assert.equal(parsed.poNumber, 'PO-42');
    assert.equal(parsed.carrier, 'Southeastern Freight');
    assert.equal(parsed.trackingNumber, '1Z999AA10123456784');
    assert.equal(parsed.weight, 1240);
    assert.equal(parsed.quantity, 4);
    assert.equal(parsed.packageType, 'pallet');
    assert.equal(parsed.length, 48);
    assert.equal(parsed.width, 40);
    assert.equal(parsed.height, 60);
    assert.equal(parsed.consigneeName, 'Naim Dahdah');
    assert.equal(parsed.destStreet, '8780 NW 100th ST');
    assert.equal(parsed.destCity, 'Medley');
    assert.equal(parsed.destState, 'FL');
    assert.equal(parsed.destZip, '33178');
    assert.equal(parsed.description, 'Collagen supplements');
    assert.equal(parsed.freightClass, '85');
});

test('parseBOLText does not treat arbitrary long numbers as tracking numbers', () => {
    const parsed = parseBOLText(`
        REF 202603031234
        Invoice Total 1234567890123456
        Weight 250 LBS
        Qty: 2 boxes
    `);

    assert.equal(parsed.trackingNumber, undefined);
    assert.equal(parsed.quantity, 2);
    assert.equal(parsed.packageType, 'box');
});

test('parseBOLText caps quantity and records original quantity', () => {
    const parsed = parseBOLText('Quantity: 1205 pallets', { maxCargoItems: 1000 });

    assert.equal(parsed.quantity, 1000);
    assert.equal(parsed.quantityCapped, true);
    assert.equal(parsed.originalQuantity, 1205);
});

test('parseBOLText falls back to trailing destination address when no consignee block exists', () => {
    const parsed = parseBOLText(`
        Carrier: ABC Trucking
        Description: Palletized inventory
        Final destination 1606 Beach Blvd Biloxi, MS 39531
    `);

    assert.equal(parsed.destStreet, '1606 Beach Blvd');
    assert.equal(parsed.destCity, 'Biloxi');
    assert.equal(parsed.destState, 'MS');
    assert.equal(parsed.destZip, '39531');
});
