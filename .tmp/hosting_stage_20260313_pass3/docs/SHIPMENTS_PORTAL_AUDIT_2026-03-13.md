# Shipments Portal Audit - 2026-03-13

## Scope

- Customer shipment portal: [portal/shipments.html](/Users/yuri/miamialliance3pl/portal/shipments.html)
- Shared shipment helpers: [js/shipments-portal-utils.mjs](/Users/yuri/miamialliance3pl/js/shipments-portal-utils.mjs)
- BOL parser helpers: [js/bol-parser-utils.mjs](/Users/yuri/miamialliance3pl/js/bol-parser-utils.mjs)
- Admin shipment detail viewer: [portal/admin-shipments.html](/Users/yuri/miamialliance3pl/portal/admin-shipments.html)
- Admin document aggregation: [portal/admin-panel.html](/Users/yuri/miamialliance3pl/portal/admin-panel.html)
- Firebase config and storage rules: [firebase.json](/Users/yuri/miamialliance3pl/firebase.json), [storage.rules](/Users/yuri/miamialliance3pl/storage.rules)

## Findings

1. Customer shipment loading still depended on an indexed `user_id + created_at` query.
   Result: customer shipment table could fail with "error loading shipments" when the composite index path was unavailable.

2. The create-shipment button could throw before entering the `try/catch`.
   Result: payload-size failures could leave the button disabled with no recovery path.

3. Existing-shipment document uploads still archived invoices with `doc_type: 'invoice'`.
   Result: admin views expecting `commercial_invoice` could miss documents.

4. Document persistence semantics were split.
   Result: some files were inline-only, some metadata-only, and large-file "View" behavior was inconsistent across customer/admin flows.

5. The BOL parser was too permissive.
   Result: carrier, description, address, and tracking fields could absorb unrelated text from PDFs.

6. Rendering still had unsanitized HTML in shipment/BOL display paths.
   Result: malformed data could break rows or inject display garbage.

## Fixes

- Replaced customer shipment loading with a query-plan approach:
  primary ordered query when available, fallback unordered query with client-side sort/filter.
- Added tag badges to the customer shipment list via the shared row renderer.
- Moved create-shipment payload checks inside the guarded flow and restored button state through `finally`.
- Introduced storage-backed document upload with fallback to inline/metadata-only persistence.
- Standardized invoice document type to `commercial_invoice`.
- Updated existing-shipment upload modal to use the same document persistence path as initial shipment creation.
- Updated admin shipment viewer to resolve `url` or `file_data` and removed the extra `shipment_id + doc_type` query dependence.
- Updated admin document aggregation to preserve `url` and `storage_path` metadata.
- Tightened BOL parsing around labeled extraction, address parsing, tracking detection, and field bleed.
- Escaped shipment/BOL-rendered values before inserting them into HTML.
- Added Firebase Storage rules for `shipment_uploads/<userId>/...`.

## Buttons Audited

- `new-shipment-calc-btn`
- `add-incoming-item-btn`
- `sc-create-btn`
- `bol-auto-fill-btn`
- `cargo-add-btn`
- `shipment-upload-link`
- `doc-upload-save-btn`
- `btn-panel-save`

## Tests Added

- [tests/shipments-portal-utils.test.mjs](/Users/yuri/miamialliance3pl/tests/shipments-portal-utils.test.mjs)
- [tests/bol-parser-utils.test.mjs](/Users/yuri/miamialliance3pl/tests/bol-parser-utils.test.mjs)
- [tests/shipment-flow-static-audit.test.mjs](/Users/yuri/miamialliance3pl/tests/shipment-flow-static-audit.test.mjs)

Command used:

```sh
node --test /Users/yuri/miamialliance3pl/tests/*.mjs
```

Result: 14 tests passed.

## Residual Risk

- Firebase Storage is not initialized yet in project `miamialliance3pl`, so storage-rule deployment is currently blocked and uploads run through the inline/metadata fallback path.
- The customer and admin shipment flows are now covered by targeted regression tests, not a full authenticated browser E2E.
- Historical bad parser output already stored in Firestore is not automatically repaired by this change.
