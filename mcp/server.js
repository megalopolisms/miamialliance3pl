#!/usr/bin/env node
/**
 * Miami Alliance 3PL - MCP Server
 * @module mcp-server
 * @version 1.1.0
 * @description Model Context Protocol server for maintaining system state, diagnostics, Firebase admin, and tools
 *
 * SECTION IDs:
 * - MCP-001: Server Configuration
 * - MCP-002: Tool Definitions
 * - MCP-003: Diagnostic Tools
 * - MCP-004: Database Tools
 * - MCP-005: Code Integrity Tools
 * - MCP-006: Context Management
 * - MCP-007: Health Monitoring
 * - MCP-008: Knowledge Management
 * - MCP-009: Firebase Admin Tools
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Firebase Admin Controller (lazy loaded to avoid initialization errors)
let firebaseController = null;
function getFirebaseController() {
    if (!firebaseController) {
        try {
            const { FullFirebaseController } = require('./firebase-admin');
            firebaseController = new FullFirebaseController({ projectId: 'miamialliance3pl' });
        } catch (error) {
            console.error('Firebase Admin not available:', error.message);
            return null;
        }
    }
    return firebaseController;
}

// ============================================================
// MCP-001: SERVER CONFIGURATION
// ============================================================

const CONFIG = {
    port: process.env.MCP_PORT || 3847,
    projectRoot: path.resolve(__dirname, '..'),
    logFile: path.resolve(__dirname, 'mcp.log'),
    auditFile: path.resolve(__dirname, 'audit.log'),
    stateFile: path.resolve(__dirname, 'state.json'),
    checksumFile: path.resolve(__dirname, 'checksums.json')
};

// System state (persisted across sessions)
let systemState = {
    lastHealthCheck: null,
    diagnosticResults: [],
    codeIntegrity: {},
    contextHistory: [],
    focusAreas: [],
    pendingTasks: [],
    knowledgeBase: {},
    sessionCount: 0
};

// ============================================================
// MCP-002: TOOL DEFINITIONS
// ============================================================

const TOOLS = {
    // Diagnostic Tools
    'diagnose.full': {
        id: 'MCP-003-001',
        description: 'Run complete system diagnostics',
        handler: runFullDiagnostics
    },
    'diagnose.firebase': {
        id: 'MCP-003-002',
        description: 'Test Firebase connectivity and configuration',
        handler: diagnoseFirebase
    },
    'diagnose.files': {
        id: 'MCP-003-003',
        description: 'Verify all required files exist and are valid',
        handler: diagnoseFiles
    },
    'diagnose.code': {
        id: 'MCP-003-004',
        description: 'Check code quality and consistency',
        handler: diagnoseCode
    },

    // Database Tools
    'db.status': {
        id: 'MCP-004-001',
        description: 'Check Firestore collections status',
        handler: checkDbStatus
    },
    'db.schema': {
        id: 'MCP-004-002',
        description: 'Validate database schema consistency',
        handler: validateDbSchema
    },

    // Code Integrity Tools
    'integrity.check': {
        id: 'MCP-005-001',
        description: 'Verify code checksums against known good state',
        handler: checkIntegrity
    },
    'integrity.snapshot': {
        id: 'MCP-005-002',
        description: 'Create integrity snapshot of current code',
        handler: createIntegritySnapshot
    },
    'integrity.diff': {
        id: 'MCP-005-003',
        description: 'Show changes since last integrity snapshot',
        handler: showIntegrityDiff
    },

    // Context Management
    'context.save': {
        id: 'MCP-006-001',
        description: 'Save current context/focus area',
        handler: saveContext
    },
    'context.restore': {
        id: 'MCP-006-002',
        description: 'Restore previous context/focus area',
        handler: restoreContext
    },
    'context.list': {
        id: 'MCP-006-003',
        description: 'List all saved contexts',
        handler: listContexts
    },
    'focus.set': {
        id: 'MCP-006-004',
        description: 'Set current focus area for logical continuity',
        handler: setFocus
    },
    'focus.get': {
        id: 'MCP-006-005',
        description: 'Get current focus areas',
        handler: getFocus
    },

    // Health Monitoring
    'health.check': {
        id: 'MCP-007-001',
        description: 'Quick health check of all systems',
        handler: healthCheck
    },
    'health.report': {
        id: 'MCP-007-002',
        description: 'Generate comprehensive health report',
        handler: generateHealthReport
    },

    // Knowledge Management
    'knowledge.add': {
        id: 'MCP-008-001',
        description: 'Add knowledge to persistent memory',
        handler: addKnowledge
    },
    'knowledge.query': {
        id: 'MCP-008-002',
        description: 'Query knowledge base',
        handler: queryKnowledge
    },
    'knowledge.export': {
        id: 'MCP-008-003',
        description: 'Export knowledge base',
        handler: exportKnowledge
    },

    // ============================================================
    // MCP-009: FIREBASE ADMIN TOOLS
    // ============================================================

    // Firebase Initialization
    'firebase.init': {
        id: 'MCP-009-001',
        description: 'Initialize Firebase Admin SDK',
        handler: firebaseInit
    },
    'firebase.status': {
        id: 'MCP-009-002',
        description: 'Get Firebase initialization status',
        handler: firebaseStatus
    },

    // Firestore Operations
    'firestore.collections': {
        id: 'MCP-009-003',
        description: 'List all Firestore collections',
        handler: firestoreListCollections
    },
    'firestore.stats': {
        id: 'MCP-009-004',
        description: 'Get collection statistics',
        handler: firestoreGetStats
    },
    'firestore.query': {
        id: 'MCP-009-005',
        description: 'Query documents in a collection',
        handler: firestoreQuery
    },
    'firestore.get': {
        id: 'MCP-009-006',
        description: 'Get a single document',
        handler: firestoreGetDocument
    },
    'firestore.create': {
        id: 'MCP-009-007',
        description: 'Create a new document',
        handler: firestoreCreateDocument
    },
    'firestore.update': {
        id: 'MCP-009-008',
        description: 'Update a document',
        handler: firestoreUpdateDocument
    },
    'firestore.delete': {
        id: 'MCP-009-009',
        description: 'Delete a document',
        handler: firestoreDeleteDocument
    },

    // User Management
    'users.list': {
        id: 'MCP-009-010',
        description: 'List all users',
        handler: usersListAll
    },
    'users.get': {
        id: 'MCP-009-011',
        description: 'Get user by UID or email',
        handler: usersGet
    },
    'users.create': {
        id: 'MCP-009-012',
        description: 'Create a new user',
        handler: usersCreate
    },
    'users.update': {
        id: 'MCP-009-013',
        description: 'Update user properties',
        handler: usersUpdate
    },
    'users.delete': {
        id: 'MCP-009-014',
        description: 'Delete a user',
        handler: usersDelete
    },
    'users.setRole': {
        id: 'MCP-009-015',
        description: 'Set user role (admin/employee/customer)',
        handler: usersSetRole
    },
    'users.disable': {
        id: 'MCP-009-016',
        description: 'Disable/enable a user',
        handler: usersToggleDisable
    },
    'users.resetPassword': {
        id: 'MCP-009-017',
        description: 'Generate password reset link',
        handler: usersResetPassword
    },

    // Backup & Restore
    'backup.collection': {
        id: 'MCP-009-018',
        description: 'Backup a collection to JSON',
        handler: backupCollection
    },
    'backup.all': {
        id: 'MCP-009-019',
        description: 'Backup all collections',
        handler: backupAll
    },
    'backup.restore': {
        id: 'MCP-009-020',
        description: 'Restore collection from backup',
        handler: backupRestore
    },
    'backup.list': {
        id: 'MCP-009-021',
        description: 'List available backups',
        handler: backupList
    },
    'backup.export': {
        id: 'MCP-009-022',
        description: 'Export full database snapshot',
        handler: backupExport
    },

    // Configuration
    'config.get': {
        id: 'MCP-009-023',
        description: 'Get all configuration',
        handler: configGet
    },
    'config.pricing': {
        id: 'MCP-009-024',
        description: 'Get/set pricing configuration',
        handler: configPricing
    },
    'config.stripe': {
        id: 'MCP-009-025',
        description: 'Get/set Stripe configuration',
        handler: configStripe
    },

    // Security Rules
    'security.rules.get': {
        id: 'MCP-009-026',
        description: 'Get current security rules',
        handler: securityRulesGet
    },
    'security.rules.save': {
        id: 'MCP-009-027',
        description: 'Save security rules to file',
        handler: securityRulesSave
    },
    'security.rules.generate': {
        id: 'MCP-009-028',
        description: 'Generate default security rules',
        handler: securityRulesGenerate
    },

    // Monitoring
    'monitor.stats': {
        id: 'MCP-009-029',
        description: 'Get database statistics',
        handler: monitorStats
    },
    'monitor.users': {
        id: 'MCP-009-030',
        description: 'Get user statistics',
        handler: monitorUserStats
    },
    'monitor.activity': {
        id: 'MCP-009-031',
        description: 'Get recent activity',
        handler: monitorActivity
    },

    // Batch Operations
    'batch.update': {
        id: 'MCP-009-032',
        description: 'Batch update documents',
        handler: batchUpdate
    },
    'batch.delete': {
        id: 'MCP-009-033',
        description: 'Batch delete documents',
        handler: batchDelete
    },
    'batch.create': {
        id: 'MCP-009-034',
        description: 'Batch create documents',
        handler: batchCreate
    },

    // System Tools
    'system.stats': {
        id: 'MCP-012-001',
        description: 'Get system statistics (cache, rate limits)',
        handler: systemStats
    },
    'system.cache.clear': {
        id: 'MCP-012-002',
        description: 'Clear all cached data',
        handler: systemCacheClear
    },

    // Audit Tools
    'audit.query': {
        id: 'MCP-013-001',
        description: 'Query audit log entries',
        handler: auditQuery
    },
    'audit.recent': {
        id: 'MCP-013-002',
        description: 'Get recent audit entries',
        handler: auditRecent
    }
};

// ============================================================
// MCP-003: DIAGNOSTIC TOOLS
// ============================================================

async function runFullDiagnostics(params = {}) {
    const startTime = Date.now();
    const results = {
        id: `diag-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
    };

    log('INFO', 'MCP-003-001', 'Starting full diagnostics...');

    // Test 1: File Structure
    const fileTest = await diagnoseFiles();
    results.tests.push(fileTest);
    fileTest.status === 'pass' ? results.passed++ : results.failed++;

    // Test 2: Code Quality
    const codeTest = await diagnoseCode();
    results.tests.push(codeTest);
    codeTest.status === 'pass' ? results.passed++ : results.failed++;

    // Test 3: Firebase Config
    const firebaseTest = await diagnoseFirebase();
    results.tests.push(firebaseTest);
    firebaseTest.status === 'pass' ? results.passed++ : results.failed++;

    // Test 4: Integrity Check
    const integrityTest = await checkIntegrity();
    results.tests.push(integrityTest);
    integrityTest.status === 'pass' ? results.passed++ : results.failed++;

    // Test 5: Dependencies
    const depsTest = await checkDependencies();
    results.tests.push(depsTest);
    depsTest.status === 'pass' ? results.passed++ : results.failed++;

    results.duration = Date.now() - startTime;
    results.overallStatus = results.failed === 0 ? 'HEALTHY' : 'ISSUES_FOUND';

    // Store results
    systemState.diagnosticResults.unshift(results);
    if (systemState.diagnosticResults.length > 100) {
        systemState.diagnosticResults = systemState.diagnosticResults.slice(0, 100);
    }
    systemState.lastHealthCheck = results.timestamp;
    saveState();

    log('INFO', 'MCP-003-001', `Diagnostics complete: ${results.passed}/${results.tests.length} passed`);
    return results;
}

async function diagnoseFirebase(params = {}) {
    const test = {
        name: 'Firebase Configuration',
        id: 'MCP-003-002',
        status: 'pass',
        details: [],
        recommendations: []
    };

    const firebaseConfigPath = path.join(CONFIG.projectRoot, 'js', 'firebase.js');

    try {
        if (!fs.existsSync(firebaseConfigPath)) {
            test.status = 'fail';
            test.details.push('firebase.js not found');
            test.recommendations.push('Create js/firebase.js with Firebase configuration');
            return test;
        }

        const content = fs.readFileSync(firebaseConfigPath, 'utf8');

        // Check for required config keys
        const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        for (const key of requiredKeys) {
            if (!content.includes(key)) {
                test.status = 'fail';
                test.details.push(`Missing config key: ${key}`);
            }
        }

        // Check for exposed secrets (should not have actual keys in plain text for production)
        if (content.includes('AIzaSy') && content.includes('sk_live')) {
            test.status = 'warning';
            test.details.push('Potential secret key exposure detected');
            test.recommendations.push('Consider using environment variables for production');
        }

        // Check for required exports
        const requiredExports = ['initFirebase', 'onAuthChange', 'getUserData'];
        for (const exp of requiredExports) {
            if (!content.includes(`export`) || !content.includes(exp)) {
                test.status = 'warning';
                test.details.push(`Missing export: ${exp}`);
            }
        }

        if (test.details.length === 0) {
            test.details.push('Firebase configuration looks correct');
        }

    } catch (error) {
        test.status = 'fail';
        test.details.push(`Error reading firebase.js: ${error.message}`);
    }

    return test;
}

async function diagnoseFiles(params = {}) {
    const test = {
        name: 'File Structure',
        id: 'MCP-003-003',
        status: 'pass',
        details: [],
        missingFiles: [],
        recommendations: []
    };

    const requiredFiles = [
        'index.html',
        'login.html',
        'css/style.css',
        'js/main.js',
        'js/firebase.js',
        'portal/dashboard.html',
        'portal/shipments.html',
        'portal/tracking.html',
        'portal/inventory.html',
        'portal/billing.html',
        'portal/invoices.html',
        'portal/settings.html',
        'portal/team.html',
        'portal/pricing.html',
        'portal/storage-log.html',
        'portal/customers.html',
        'portal/admin-shipments.html',
        'functions/index.js',
        'functions/package.json'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(CONFIG.projectRoot, file);
        if (!fs.existsSync(filePath)) {
            test.status = 'fail';
            test.missingFiles.push(file);
            test.details.push(`Missing: ${file}`);
        }
    }

    if (test.missingFiles.length === 0) {
        test.details.push(`All ${requiredFiles.length} required files present`);
    } else {
        test.recommendations.push('Create missing files to complete the portal');
    }

    return test;
}

async function diagnoseCode(params = {}) {
    const test = {
        name: 'Code Quality',
        id: 'MCP-003-004',
        status: 'pass',
        details: [],
        issues: [],
        recommendations: []
    };

    const htmlFiles = findFiles(CONFIG.projectRoot, '.html');
    const jsFiles = findFiles(CONFIG.projectRoot, '.js');

    // Check for common issues
    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(CONFIG.projectRoot, file);

        // Check for console.log in production
        if (content.match(/console\.(log|debug)\(/g)?.length > 5) {
            test.issues.push({
                file: relativePath,
                issue: 'Excessive console.log statements',
                severity: 'warning'
            });
        }

        // Check for TODO comments
        const todos = content.match(/TODO|FIXME|HACK/g);
        if (todos?.length > 0) {
            test.issues.push({
                file: relativePath,
                issue: `${todos.length} TODO/FIXME comments`,
                severity: 'info'
            });
        }

        // Check for duplicate Firebase configs
        if ((content.match(/firebaseConfig\s*=/g) || []).length > 1) {
            test.issues.push({
                file: relativePath,
                issue: 'Duplicate Firebase configuration',
                severity: 'error'
            });
            test.status = 'fail';
        }
    }

    for (const file of jsFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(CONFIG.projectRoot, file);

        // Check for error handling
        if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
            test.issues.push({
                file: relativePath,
                issue: 'Async function without try/catch',
                severity: 'warning'
            });
        }
    }

    if (test.issues.length === 0) {
        test.details.push('No major code quality issues found');
    } else {
        test.details.push(`Found ${test.issues.length} issues`);
        if (test.issues.some(i => i.severity === 'error')) {
            test.status = 'fail';
        } else if (test.issues.some(i => i.severity === 'warning')) {
            test.status = 'warning';
        }
    }

    return test;
}

async function checkDependencies(params = {}) {
    const test = {
        name: 'Dependencies',
        id: 'MCP-003-005',
        status: 'pass',
        details: [],
        recommendations: []
    };

    const functionsPackage = path.join(CONFIG.projectRoot, 'functions', 'package.json');

    try {
        if (fs.existsSync(functionsPackage)) {
            const pkg = JSON.parse(fs.readFileSync(functionsPackage, 'utf8'));

            // Check for required dependencies
            const required = ['firebase-admin', 'firebase-functions', 'stripe'];
            for (const dep of required) {
                if (!pkg.dependencies?.[dep]) {
                    test.status = 'fail';
                    test.details.push(`Missing dependency: ${dep}`);
                }
            }

            // Check Node version
            if (pkg.engines?.node && !pkg.engines.node.includes('18')) {
                test.status = 'warning';
                test.details.push('Consider using Node.js 18+');
            }

            if (test.details.length === 0) {
                test.details.push('All dependencies configured correctly');
            }
        }
    } catch (error) {
        test.status = 'fail';
        test.details.push(`Error reading package.json: ${error.message}`);
    }

    return test;
}

// ============================================================
// MCP-004: DATABASE TOOLS
// ============================================================

async function checkDbStatus(params = {}) {
    return {
        name: 'Database Status',
        id: 'MCP-004-001',
        status: 'info',
        collections: [
            { name: 'users', description: 'Customer and staff accounts' },
            { name: 'shipments', description: 'Shipment records' },
            { name: 'inventory', description: 'Inventory items' },
            { name: 'invoices', description: 'Billing invoices' },
            { name: 'storage_snapshots', description: 'Daily storage records' },
            { name: 'billable_events', description: 'Billing events log' },
            { name: 'invites', description: 'Team invitations' },
            { name: 'settings', description: 'System settings' }
        ],
        note: 'Use Firebase Console for live data inspection'
    };
}

async function validateDbSchema(params = {}) {
    const schemas = {
        users: {
            required: ['email', 'role'],
            optional: ['name', 'company_name', 'phone', 'address', 'created_at']
        },
        shipments: {
            required: ['user_id', 'tracking_number', 'status', 'created_at'],
            optional: ['origin', 'destination', 'package', 'service_type', 'notes']
        },
        invoices: {
            required: ['customer_id', 'invoice_number', 'status', 'total'],
            optional: ['line_items', 'billing_period_start', 'billing_period_end', 'due_date']
        },
        inventory: {
            required: ['user_id', 'sku'],
            optional: ['name', 'quantity', 'location', 'category']
        }
    };

    return {
        name: 'Database Schema',
        id: 'MCP-004-002',
        status: 'info',
        schemas,
        note: 'Schema definitions for Firestore collections'
    };
}

// ============================================================
// MCP-005: CODE INTEGRITY TOOLS
// ============================================================

async function checkIntegrity(params = {}) {
    const test = {
        name: 'Code Integrity',
        id: 'MCP-005-001',
        status: 'pass',
        details: [],
        changes: [],
        recommendations: []
    };

    try {
        if (!fs.existsSync(CONFIG.checksumFile)) {
            test.status = 'info';
            test.details.push('No integrity snapshot found. Run integrity.snapshot first.');
            test.recommendations.push('Create baseline snapshot with integrity.snapshot');
            return test;
        }

        const savedChecksums = JSON.parse(fs.readFileSync(CONFIG.checksumFile, 'utf8'));
        const currentChecksums = await generateChecksums();

        // Compare checksums
        for (const [file, hash] of Object.entries(savedChecksums.files)) {
            if (!currentChecksums.files[file]) {
                test.changes.push({ file, change: 'deleted' });
            } else if (currentChecksums.files[file] !== hash) {
                test.changes.push({ file, change: 'modified' });
            }
        }

        // Check for new files
        for (const [file, hash] of Object.entries(currentChecksums.files)) {
            if (!savedChecksums.files[file]) {
                test.changes.push({ file, change: 'added' });
            }
        }

        if (test.changes.length > 0) {
            test.status = 'warning';
            test.details.push(`${test.changes.length} files changed since snapshot`);
        } else {
            test.details.push('All files match integrity snapshot');
        }

    } catch (error) {
        test.status = 'fail';
        test.details.push(`Error checking integrity: ${error.message}`);
    }

    return test;
}

async function createIntegritySnapshot(params = {}) {
    const checksums = await generateChecksums();
    checksums.created = new Date().toISOString();
    checksums.version = '1.0.0';

    fs.writeFileSync(CONFIG.checksumFile, JSON.stringify(checksums, null, 2));

    log('INFO', 'MCP-005-002', `Created integrity snapshot with ${Object.keys(checksums.files).length} files`);

    return {
        status: 'success',
        fileCount: Object.keys(checksums.files).length,
        created: checksums.created
    };
}

async function showIntegrityDiff(params = {}) {
    const integrityResult = await checkIntegrity();
    return {
        ...integrityResult,
        changes: integrityResult.changes || []
    };
}

async function generateChecksums() {
    const checksums = { files: {} };
    const extensions = ['.html', '.js', '.css', '.json'];

    const files = findFiles(CONFIG.projectRoot, extensions)
        .filter(f => !f.includes('node_modules') && !f.includes('mcp/'));

    for (const file of files) {
        const content = fs.readFileSync(file);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const relativePath = path.relative(CONFIG.projectRoot, file);
        checksums.files[relativePath] = hash;
    }

    return checksums;
}

// ============================================================
// MCP-006: CONTEXT MANAGEMENT
// ============================================================

async function saveContext(params = {}) {
    const context = {
        id: `ctx-${Date.now()}`,
        timestamp: new Date().toISOString(),
        name: params.name || 'Unnamed Context',
        focusAreas: [...systemState.focusAreas],
        pendingTasks: [...systemState.pendingTasks],
        notes: params.notes || '',
        metadata: params.metadata || {}
    };

    systemState.contextHistory.unshift(context);
    if (systemState.contextHistory.length > 50) {
        systemState.contextHistory = systemState.contextHistory.slice(0, 50);
    }
    saveState();

    log('INFO', 'MCP-006-001', `Saved context: ${context.name}`);
    return { success: true, contextId: context.id };
}

async function restoreContext(params = {}) {
    const contextId = params.id;

    if (!contextId) {
        // Restore most recent
        if (systemState.contextHistory.length > 0) {
            const context = systemState.contextHistory[0];
            systemState.focusAreas = context.focusAreas || [];
            systemState.pendingTasks = context.pendingTasks || [];
            saveState();
            return { success: true, restored: context };
        }
        return { success: false, error: 'No contexts saved' };
    }

    const context = systemState.contextHistory.find(c => c.id === contextId);
    if (context) {
        systemState.focusAreas = context.focusAreas || [];
        systemState.pendingTasks = context.pendingTasks || [];
        saveState();
        return { success: true, restored: context };
    }

    return { success: false, error: 'Context not found' };
}

async function listContexts(params = {}) {
    return {
        contexts: systemState.contextHistory.map(c => ({
            id: c.id,
            name: c.name,
            timestamp: c.timestamp,
            focusCount: c.focusAreas?.length || 0,
            taskCount: c.pendingTasks?.length || 0
        })),
        total: systemState.contextHistory.length
    };
}

async function setFocus(params = {}) {
    const focus = {
        id: `focus-${Date.now()}`,
        area: params.area,
        priority: params.priority || 'normal',
        description: params.description || '',
        created: new Date().toISOString()
    };

    systemState.focusAreas.push(focus);
    saveState();

    log('INFO', 'MCP-006-004', `Focus set: ${focus.area}`);
    return { success: true, focus };
}

async function getFocus(params = {}) {
    return {
        currentFocus: systemState.focusAreas,
        count: systemState.focusAreas.length
    };
}

// ============================================================
// MCP-007: HEALTH MONITORING
// ============================================================

async function healthCheck(params = {}) {
    const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };

    // Check file system
    health.checks.fileSystem = fs.existsSync(CONFIG.projectRoot) ? 'ok' : 'error';

    // Check state file
    health.checks.stateFile = fs.existsSync(CONFIG.stateFile) ? 'ok' : 'missing';

    // Check key files
    const keyFiles = ['index.html', 'portal/dashboard.html', 'js/firebase.js'];
    health.checks.keyFiles = keyFiles.every(f =>
        fs.existsSync(path.join(CONFIG.projectRoot, f))
    ) ? 'ok' : 'incomplete';

    // Determine overall status
    if (Object.values(health.checks).includes('error')) {
        health.status = 'error';
    } else if (Object.values(health.checks).includes('missing') || Object.values(health.checks).includes('incomplete')) {
        health.status = 'warning';
    }

    systemState.lastHealthCheck = health.timestamp;
    saveState();

    return health;
}

async function generateHealthReport(params = {}) {
    const diagnostics = await runFullDiagnostics();
    const health = await healthCheck();

    const report = {
        generated: new Date().toISOString(),
        summary: {
            overallHealth: health.status,
            testsRun: diagnostics.tests.length,
            testsPassed: diagnostics.passed,
            testsFailed: diagnostics.failed,
            duration: diagnostics.duration + 'ms'
        },
        diagnostics,
        health,
        systemState: {
            sessionCount: systemState.sessionCount,
            contextsSaved: systemState.contextHistory.length,
            focusAreas: systemState.focusAreas.length,
            knowledgeEntries: Object.keys(systemState.knowledgeBase).length
        },
        recommendations: []
    };

    // Generate recommendations
    if (diagnostics.failed > 0) {
        report.recommendations.push('Address failing diagnostic tests');
    }
    if (systemState.focusAreas.length === 0) {
        report.recommendations.push('Set focus areas for better context tracking');
    }
    if (!fs.existsSync(CONFIG.checksumFile)) {
        report.recommendations.push('Create integrity snapshot for code monitoring');
    }

    return report;
}

// ============================================================
// MCP-008: KNOWLEDGE MANAGEMENT
// ============================================================

async function addKnowledge(params = {}) {
    const entry = {
        id: `kb-${Date.now()}`,
        category: params.category || 'general',
        key: params.key,
        value: params.value,
        tags: params.tags || [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    };

    if (!systemState.knowledgeBase[entry.category]) {
        systemState.knowledgeBase[entry.category] = {};
    }
    systemState.knowledgeBase[entry.category][entry.key] = entry;
    saveState();

    log('INFO', 'MCP-008-001', `Knowledge added: ${entry.category}/${entry.key}`);
    return { success: true, entry };
}

async function queryKnowledge(params = {}) {
    const category = params.category;
    const key = params.key;
    const search = params.search;

    if (category && key) {
        return systemState.knowledgeBase[category]?.[key] || null;
    }

    if (category) {
        return systemState.knowledgeBase[category] || {};
    }

    if (search) {
        const results = [];
        for (const [cat, entries] of Object.entries(systemState.knowledgeBase)) {
            for (const [k, entry] of Object.entries(entries)) {
                if (k.includes(search) || entry.value?.toString().includes(search)) {
                    results.push(entry);
                }
            }
        }
        return results;
    }

    return systemState.knowledgeBase;
}

async function exportKnowledge(params = {}) {
    return {
        exported: new Date().toISOString(),
        categories: Object.keys(systemState.knowledgeBase),
        totalEntries: Object.values(systemState.knowledgeBase)
            .reduce((sum, cat) => sum + Object.keys(cat).length, 0),
        data: systemState.knowledgeBase
    };
}

// ============================================================
// MCP-009: FIREBASE ADMIN HANDLERS
// ============================================================

// Error codes for better debugging
const ERROR_CODES = {
    FIREBASE_NOT_AVAILABLE: 'FA-001',
    FIREBASE_NOT_INITIALIZED: 'FA-002',
    MISSING_PARAMETER: 'FA-003',
    INVALID_PARAMETER: 'FA-004',
    OPERATION_FAILED: 'FA-005',
    NOT_FOUND: 'FA-006',
    PERMISSION_DENIED: 'FA-007',
    RATE_LIMITED: 'FA-008'
};

// Custom error class for MCP errors
class MCPError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

// Helper to ensure Firebase is available
function requireFirebase() {
    const fc = getFirebaseController();
    if (!fc) {
        throw new MCPError(
            ERROR_CODES.FIREBASE_NOT_AVAILABLE,
            'Firebase Admin not available. Run "npm install" in the mcp directory.',
            { hint: 'cd mcp && npm install' }
        );
    }
    return fc;
}

// Helper to check initialization
function requireFirebaseInit() {
    const fc = requireFirebase();
    if (!fc.firestore.initialized) {
        throw new MCPError(
            ERROR_CODES.FIREBASE_NOT_INITIALIZED,
            'Firebase not initialized. Call firebase.init first.',
            { hint: 'Run tool: firebase.init with serviceAccountPath parameter' }
        );
    }
    return fc;
}

// Parameter validation helper
function validateParams(params, required, optional = []) {
    const missing = required.filter(p => params[p] === undefined || params[p] === null);
    if (missing.length > 0) {
        throw new MCPError(
            ERROR_CODES.MISSING_PARAMETER,
            `Missing required parameters: ${missing.join(', ')}`,
            { required, optional, received: Object.keys(params) }
        );
    }
}

// Retry wrapper for transient failures
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (error.code === 'UNAVAILABLE' || error.code === 'DEADLINE_EXCEEDED') {
                await new Promise(r => setTimeout(r, delayMs * (i + 1)));
                continue;
            }
            throw error;
        }
    }
    throw new MCPError(
        ERROR_CODES.OPERATION_FAILED,
        `Operation failed after ${maxRetries} retries: ${lastError.message}`,
        { originalError: lastError.message }
    );
}

// ============================================================
// INPUT VALIDATION & SANITIZATION (MCP-010)
// ============================================================

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Invalid email format',
            { received: email }
        );
    }
    return email.toLowerCase().trim();
}

// UID validation (Firebase UIDs are 28 chars, alphanumeric)
function validateUID(uid) {
    if (typeof uid !== 'string' || uid.length < 1 || uid.length > 128) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Invalid UID format',
            { received: uid, hint: 'UID must be 1-128 characters' }
        );
    }
    return uid.trim();
}

// Collection name validation (alphanumeric, underscores, hyphens)
function validateCollectionName(name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Invalid collection name',
            { received: name, hint: 'Only alphanumeric, underscore, and hyphen allowed' }
        );
    }
    return name;
}

// Sanitize document data (remove potentially dangerous fields)
function sanitizeDocumentData(data) {
    if (typeof data !== 'object' || data === null) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Document data must be an object',
            { received: typeof data }
        );
    }

    // Remove fields that could be problematic
    const sanitized = { ...data };
    delete sanitized.__proto__;
    delete sanitized.constructor;
    delete sanitized.prototype;

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeDocumentData(value);
        }
    }

    return sanitized;
}

// ============================================================
// CACHING LAYER (MCP-011)
// ============================================================

const cache = {
    data: new Map(),
    ttl: 60000, // 1 minute default TTL
    maxSize: 1000,

    // Generate cache key
    key(prefix, ...parts) {
        return `${prefix}:${parts.join(':')}`;
    },

    // Get from cache
    get(key) {
        const entry = this.data.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.data.delete(key);
            return null;
        }
        return entry.value;
    },

    // Set in cache
    set(key, value, ttl = this.ttl) {
        // Evict oldest if at capacity
        if (this.data.size >= this.maxSize) {
            const oldest = this.data.keys().next().value;
            this.data.delete(oldest);
        }
        this.data.set(key, {
            value,
            expires: Date.now() + ttl,
            created: Date.now()
        });
    },

    // Invalidate cache entries
    invalidate(pattern) {
        for (const key of this.data.keys()) {
            if (key.startsWith(pattern)) {
                this.data.delete(key);
            }
        }
    },

    // Clear all cache
    clear() {
        this.data.clear();
    },

    // Get cache stats
    stats() {
        return {
            size: this.data.size,
            maxSize: this.maxSize,
            ttl: this.ttl
        };
    }
};

// Cache-wrapped function helper
async function withCache(key, fn, ttl) {
    const cached = cache.get(key);
    if (cached !== null) {
        return { ...cached, _cached: true };
    }
    const result = await fn();
    cache.set(key, result, ttl);
    return result;
}

// Rate limiting
const rateLimiter = {
    requests: new Map(),
    windowMs: 60000, // 1 minute window
    maxRequests: 100, // 100 requests per minute

    check(clientId) {
        const now = Date.now();
        const clientData = this.requests.get(clientId) || { count: 0, windowStart: now };

        // Reset window if expired
        if (now - clientData.windowStart > this.windowMs) {
            clientData.count = 0;
            clientData.windowStart = now;
        }

        clientData.count++;
        this.requests.set(clientId, clientData);

        if (clientData.count > this.maxRequests) {
            throw new MCPError(
                ERROR_CODES.RATE_LIMITED,
                'Rate limit exceeded',
                { limit: this.maxRequests, windowMs: this.windowMs, retryAfter: this.windowMs - (now - clientData.windowStart) }
            );
        }

        return true;
    },

    stats() {
        return {
            activeClients: this.requests.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests
        };
    }
}

// System Tools
async function systemStats(params = {}) {
    return {
        cache: cache.stats(),
        rateLimiter: rateLimiter.stats(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        firebase: {
            available: !!getFirebaseController(),
            initialized: getFirebaseController()?.firestore?.initialized || false
        }
    };
}

async function systemCacheClear(params = {}) {
    const before = cache.stats().size;
    cache.clear();
    log('INFO', 'MCP-012-002', `Cache cleared: ${before} entries removed`);
    return { success: true, entriesCleared: before };
}

// Audit handlers
async function auditQuery(params = {}) {
    return {
        entries: auditTrail.query({
            operation: params.operation,
            since: params.since,
            success: params.success,
            limit: params.limit || 50
        }),
        totalInMemory: (systemState.auditLog || []).length
    };
}

async function auditRecent(params = {}) {
    return {
        entries: auditTrail.query({ limit: params.limit || 20 }),
        totalInMemory: (systemState.auditLog || []).length
    };
}

// Firebase Initialization
async function firebaseInit(params = {}) {
    const fc = requireFirebase();
    log('INFO', 'MCP-009-001', 'Initializing Firebase Admin...');
    cache.clear(); // Clear cache on reinit
    return await fc.initialize(params.serviceAccountPath);
}

async function firebaseStatus(params = {}) {
    const fc = getFirebaseController();
    return {
        available: !!fc,
        initialized: fc?.firestore?.initialized || false,
        projectId: fc?.firestore?.projectId || null
    };
}

// Firestore Operations
async function firestoreListCollections(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-003', 'Listing Firestore collections...');
    // Cache for 5 minutes (collections don't change often)
    return await withCache(
        cache.key('collections', 'list'),
        () => fc.firestore.listCollections(),
        300000
    );
}

async function firestoreGetStats(params = {}) {
    validateParams(params, ['collection']);
    const collection = validateCollectionName(params.collection);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-004', `Getting stats for: ${collection}`);
    // Cache stats for 2 minutes
    return await withCache(
        cache.key('stats', collection),
        () => withRetry(() => fc.firestore.getCollectionStats(collection)),
        120000
    );
}

async function firestoreQuery(params = {}) {
    validateParams(params, ['collection'], ['where', 'orderBy', 'limit']);
    const collection = validateCollectionName(params.collection);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-005', `Querying: ${collection}`);
    return await withRetry(() => fc.firestore.queryDocuments(collection, {
        where: params.where,
        orderBy: params.orderBy,
        limit: params.limit || 50
    }));
}

async function firestoreGetDocument(params = {}) {
    validateParams(params, ['collection', 'id']);
    const collection = validateCollectionName(params.collection);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-006', `Getting document: ${collection}/${params.id}`);
    // Cache single documents for 30 seconds
    return await withCache(
        cache.key('doc', collection, params.id),
        () => withRetry(() => fc.firestore.getDocument(collection, params.id)),
        30000
    );
}

async function firestoreCreateDocument(params = {}) {
    validateParams(params, ['collection', 'data'], ['id']);
    const collection = validateCollectionName(params.collection);
    const data = sanitizeDocumentData(params.data);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-007', `Creating document in: ${collection}`);
    // Invalidate related caches
    cache.invalidate(`stats:${collection}`);
    cache.invalidate(`collections`);
    return await withRetry(() => fc.firestore.createDocument(collection, data, params.id));
}

async function firestoreUpdateDocument(params = {}) {
    validateParams(params, ['collection', 'id', 'data'], ['merge']);
    const collection = validateCollectionName(params.collection);
    const data = sanitizeDocumentData(params.data);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-008', `Updating document: ${collection}/${params.id}`);
    // Invalidate related caches
    cache.invalidate(`doc:${collection}:${params.id}`);
    cache.invalidate(`stats:${collection}`);
    return await withRetry(() => fc.firestore.updateDocument(collection, params.id, data, params.merge));
}

async function firestoreDeleteDocument(params = {}) {
    validateParams(params, ['collection', 'id']);
    const collection = validateCollectionName(params.collection);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-009', `Deleting document: ${collection}/${params.id}`);
    // Invalidate related caches
    cache.invalidate(`doc:${collection}:${params.id}`);
    cache.invalidate(`stats:${collection}`);
    return await withRetry(() => fc.firestore.deleteDocument(collection, params.id));
}

// User Management
async function usersListAll(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-010', 'Listing users...');
    return await withRetry(() => fc.users.listUsers(params.limit || 100, params.pageToken));
}

async function usersGet(params = {}) {
    if (!params.uid && !params.email) {
        throw new MCPError(
            ERROR_CODES.MISSING_PARAMETER,
            'Either uid or email parameter required',
            { required: ['uid OR email'] }
        );
    }
    const fc = requireFirebaseInit();
    if (params.email) {
        const email = validateEmail(params.email);
        log('INFO', 'MCP-009-011', `Getting user by email: ${email}`);
        return await withRetry(() => fc.users.getUserByEmail(email));
    }
    const uid = validateUID(params.uid);
    log('INFO', 'MCP-009-011', `Getting user by UID: ${uid}`);
    return await withRetry(() => fc.users.getUser(uid));
}

async function usersCreate(params = {}) {
    validateParams(params, ['email', 'password'], ['displayName', 'phoneNumber', 'role']);
    const email = validateEmail(params.email);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-012', `Creating user: ${email}`);
    try {
        const result = await withRetry(() => fc.users.createUser({ ...params, email }));
        auditTrail.log('users.create', { email, role: params.role }, result);
        return result;
    } catch (error) {
        auditTrail.log('users.create', { email, role: params.role }, null, error);
        throw error;
    }
}

async function usersUpdate(params = {}) {
    validateParams(params, ['uid'], ['email', 'displayName', 'phoneNumber', 'password', 'disabled', 'role']);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-013', `Updating user: ${params.uid}`);
    return await withRetry(() => fc.users.updateUser(params.uid, params));
}

async function usersDelete(params = {}) {
    validateParams(params, ['uid']);
    const uid = validateUID(params.uid);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-014', `Deleting user: ${uid}`);
    try {
        const result = await withRetry(() => fc.users.deleteUser(uid));
        auditTrail.log('users.delete', { uid }, result);
        return result;
    } catch (error) {
        auditTrail.log('users.delete', { uid }, null, error);
        throw error;
    }
}

async function usersSetRole(params = {}) {
    validateParams(params, ['uid', 'role']);
    const uid = validateUID(params.uid);
    const validRoles = ['admin', 'employee', 'customer'];
    if (!validRoles.includes(params.role)) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            `Invalid role: ${params.role}`,
            { validRoles, received: params.role }
        );
    }
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-015', `Setting role for ${uid}: ${params.role}`);
    try {
        const result = await withRetry(() => fc.users.setUserRole(uid, params.role));
        auditTrail.log('users.setRole', { uid, role: params.role }, result);
        return result;
    } catch (error) {
        auditTrail.log('users.setRole', { uid, role: params.role }, null, error);
        throw error;
    }
}

async function usersToggleDisable(params = {}) {
    validateParams(params, ['uid'], ['disable']);
    const fc = requireFirebaseInit();
    const action = params.disable ? 'disable' : 'enable';
    log('INFO', 'MCP-009-016', `${action} user: ${params.uid}`);
    if (params.disable) {
        return await withRetry(() => fc.users.disableUser(params.uid));
    }
    return await withRetry(() => fc.users.enableUser(params.uid));
}

async function usersResetPassword(params = {}) {
    validateParams(params, ['email']);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-017', `Generating reset link for: ${params.email}`);
    return await withRetry(() => fc.users.generatePasswordResetLink(params.email));
}

// Backup & Restore
async function backupCollection(params = {}) {
    validateParams(params, ['collection']);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-018', `Backing up collection: ${params.collection}`);
    return await withRetry(() => fc.backup.backupCollection(params.collection));
}

async function backupAll(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-019', 'Backing up all collections...');
    return await withRetry(() => fc.backup.backupAll());
}

async function backupRestore(params = {}) {
    validateParams(params, ['collection', 'file']);
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-020', `Restoring collection: ${params.collection} from ${params.file}`);
    return await withRetry(() => fc.backup.restoreCollection(params.collection, params.file));
}

async function backupList(params = {}) {
    const fc = requireFirebase();
    return fc.backup.listBackups();
}

async function backupExport(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-022', 'Exporting full database...');
    return await fc.backup.exportDatabase();
}

// Configuration
async function configGet(params = {}) {
    const fc = requireFirebase();
    if (fc.config.initialized) {
        return await fc.config.getConfig();
    }
    return {
        initialized: false,
        message: 'Firebase not initialized'
    };
}

async function configPricing(params = {}) {
    const fc = requireFirebaseInit();
    if (params.set) {
        log('INFO', 'MCP-009-024', 'Updating pricing config...');
        return await fc.config.updatePricing(params.set);
    }
    return await fc.config.getPricing();
}

async function configStripe(params = {}) {
    const fc = requireFirebaseInit();
    if (params.set) {
        log('INFO', 'MCP-009-025', 'Updating Stripe config...');
        return await fc.config.updateStripeConfig(params.set);
    }
    return await fc.config.getStripeConfig();
}

// Security Rules
async function securityRulesGet(params = {}) {
    const fc = requireFirebase();
    return await fc.security.getSecurityRules();
}

async function securityRulesSave(params = {}) {
    validateParams(params, ['rules']);
    const fc = requireFirebase();
    log('INFO', 'MCP-009-027', 'Saving security rules...');
    return await fc.security.saveSecurityRules(params.rules);
}

async function securityRulesGenerate(params = {}) {
    const fc = requireFirebase();
    log('INFO', 'MCP-009-028', 'Generating default security rules...');
    const rules = fc.security.generateDefaultRules();
    if (params.save) {
        await fc.security.saveSecurityRules(rules);
        return { rules, saved: true };
    }
    return { rules, saved: false };
}

// Monitoring
async function monitorStats(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-029', 'Getting database stats...');
    return await fc.monitoring.getDatabaseStats();
}

async function monitorUserStats(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-030', 'Getting user stats...');
    return await fc.monitoring.getUserStats();
}

async function monitorActivity(params = {}) {
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-031', 'Getting recent activity...');
    return await fc.monitoring.getRecentActivity(params.limit || 50);
}

// Batch Operations
async function batchUpdate(params = {}) {
    validateParams(params, ['collection', 'updates']);
    if (!Array.isArray(params.updates) || params.updates.length === 0) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'updates must be a non-empty array',
            { received: typeof params.updates }
        );
    }
    if (params.updates.length > 500) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Firestore batch limit is 500 documents',
            { received: params.updates.length, max: 500 }
        );
    }
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-032', `Batch updating ${params.updates.length} docs in ${params.collection}`);
    return await withRetry(() => fc.batch.batchUpdate(params.collection, params.updates));
}

async function batchDelete(params = {}) {
    validateParams(params, ['collection', 'ids']);
    if (!Array.isArray(params.ids) || params.ids.length === 0) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'ids must be a non-empty array',
            { received: typeof params.ids }
        );
    }
    if (params.ids.length > 500) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Firestore batch limit is 500 documents',
            { received: params.ids.length, max: 500 }
        );
    }
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-033', `Batch deleting ${params.ids.length} docs from ${params.collection}`);
    return await withRetry(() => fc.batch.batchDelete(params.collection, params.ids));
}

async function batchCreate(params = {}) {
    validateParams(params, ['collection', 'documents']);
    if (!Array.isArray(params.documents) || params.documents.length === 0) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'documents must be a non-empty array',
            { received: typeof params.documents }
        );
    }
    if (params.documents.length > 500) {
        throw new MCPError(
            ERROR_CODES.INVALID_PARAMETER,
            'Firestore batch limit is 500 documents',
            { received: params.documents.length, max: 500 }
        );
    }
    const fc = requireFirebaseInit();
    log('INFO', 'MCP-009-034', `Batch creating ${params.documents.length} docs in ${params.collection}`);
    return await withRetry(() => fc.batch.batchCreate(params.collection, params.documents));
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function findFiles(dir, extensions, files = []) {
    if (typeof extensions === 'string') extensions = [extensions];

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (item === 'node_modules' || item === '.git' || item === 'mcp') continue;

        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findFiles(fullPath, extensions, files);
            } else if (extensions.some(ext => item.endsWith(ext))) {
                files.push(fullPath);
            }
        } catch (e) {
            // Skip inaccessible files
        }
    }
    return files;
}

// Enhanced logging system
const logger = {
    levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, AUDIT: 4 },
    currentLevel: 1, // INFO by default

    format(level, sectionId, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            level,
            sectionId,
            message,
            ...metadata
        };
        return JSON.stringify(entry);
    },

    write(level, sectionId, message, metadata = {}) {
        if (this.levels[level] < this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] [${sectionId}] ${message}\n`;

        // Write human-readable to console
        console.log(logLine.trim());

        // Write structured JSON to file
        fs.appendFileSync(CONFIG.logFile, logLine);

        // For AUDIT level, also write to audit log
        if (level === 'AUDIT') {
            const auditEntry = this.format(level, sectionId, message, metadata);
            fs.appendFileSync(CONFIG.auditFile, auditEntry + '\n');
        }
    },

    debug(sectionId, message, meta) { this.write('DEBUG', sectionId, message, meta); },
    info(sectionId, message, meta) { this.write('INFO', sectionId, message, meta); },
    warn(sectionId, message, meta) { this.write('WARN', sectionId, message, meta); },
    error(sectionId, message, meta) { this.write('ERROR', sectionId, message, meta); },
    audit(sectionId, action, details) {
        this.write('AUDIT', sectionId, action, {
            action,
            details,
            auditTimestamp: Date.now()
        });
    }
};

// Legacy log function for compatibility
function log(level, sectionId, message) {
    logger.write(level, sectionId, message);
}

// Audit trail for sensitive operations
const auditTrail = {
    log(operation, params, result, error = null) {
        const entry = {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            operation,
            params: this.sanitizeParams(params),
            success: !error,
            error: error?.message || null,
            resultSummary: this.summarizeResult(result)
        };

        // Store in state for queryability
        if (!systemState.auditLog) {
            systemState.auditLog = [];
        }
        systemState.auditLog.unshift(entry);
        if (systemState.auditLog.length > 500) {
            systemState.auditLog = systemState.auditLog.slice(0, 500);
        }

        logger.audit('AUDIT-001', operation, entry);
        return entry;
    },

    // Remove sensitive data from params before logging
    sanitizeParams(params) {
        if (!params) return null;
        const sanitized = { ...params };
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey'];
        for (const key of sensitiveKeys) {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        }
        return sanitized;
    },

    // Create summary of result for logging
    summarizeResult(result) {
        if (!result) return null;
        if (typeof result !== 'object') return result;
        if (result.success !== undefined) return { success: result.success };
        if (result.uid) return { uid: result.uid };
        if (result.id) return { id: result.id };
        if (Array.isArray(result)) return { count: result.length };
        return { keys: Object.keys(result).slice(0, 5) };
    },

    // Query audit log
    query(filter = {}) {
        let results = systemState.auditLog || [];

        if (filter.operation) {
            results = results.filter(e => e.operation.includes(filter.operation));
        }
        if (filter.since) {
            results = results.filter(e => new Date(e.timestamp) >= new Date(filter.since));
        }
        if (filter.success !== undefined) {
            results = results.filter(e => e.success === filter.success);
        }

        return results.slice(0, filter.limit || 100);
    }
};

function loadState() {
    try {
        if (fs.existsSync(CONFIG.stateFile)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'));
            systemState = { ...systemState, ...data };
            systemState.sessionCount++;
        }
    } catch (error) {
        log('ERROR', 'MCP-001', `Failed to load state: ${error.message}`);
    }
}

function saveState() {
    try {
        fs.writeFileSync(CONFIG.stateFile, JSON.stringify(systemState, null, 2));
    } catch (error) {
        log('ERROR', 'MCP-001', `Failed to save state: ${error.message}`);
    }
}

// ============================================================
// HTTP SERVER
// ============================================================

function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
            // Route: /tools - List available tools
            if (req.url === '/tools' && req.method === 'GET') {
                const toolList = Object.entries(TOOLS).map(([name, tool]) => ({
                    name,
                    id: tool.id,
                    description: tool.description
                }));
                res.writeHead(200);
                res.end(JSON.stringify({ tools: toolList }));
                return;
            }

            // Route: /run - Execute a tool
            if (req.url === '/run' && req.method === 'POST') {
                const { tool, params } = JSON.parse(body || '{}');

                if (!tool || !TOOLS[tool]) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Unknown tool', availableTools: Object.keys(TOOLS) }));
                    return;
                }

                log('INFO', TOOLS[tool].id, `Executing tool: ${tool}`);
                const result = await TOOLS[tool].handler(params || {});

                res.writeHead(200);
                res.end(JSON.stringify({ success: true, result }));
                return;
            }

            // Route: /health - Quick health check
            if (req.url === '/health') {
                const health = await healthCheck();
                res.writeHead(200);
                res.end(JSON.stringify(health));
                return;
            }

            // Route: /state - Get system state
            if (req.url === '/state') {
                res.writeHead(200);
                res.end(JSON.stringify(systemState));
                return;
            }

            // Default: 404
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found', routes: ['/tools', '/run', '/health', '/state'] }));

        } catch (error) {
            log('ERROR', 'MCP-001', `Request error: ${error.message}`);
            const statusCode = error instanceof MCPError ? 400 : 500;
            res.writeHead(statusCode);
            if (error instanceof MCPError) {
                res.end(JSON.stringify(error.toJSON()));
            } else {
                res.end(JSON.stringify({
                    code: 'INTERNAL_ERROR',
                    message: error.message,
                    timestamp: new Date().toISOString()
                }));
            }
        }
    });
}

// ============================================================
// MAIN
// ============================================================

// Ensure mcp directory exists
if (!fs.existsSync(path.dirname(CONFIG.logFile))) {
    fs.mkdirSync(path.dirname(CONFIG.logFile), { recursive: true });
}

// Load persisted state
loadState();

// Start server
const server = http.createServer(handleRequest);
server.listen(CONFIG.port, () => {
    log('INFO', 'MCP-001', `MCP Server started on port ${CONFIG.port}`);
    log('INFO', 'MCP-001', `Session #${systemState.sessionCount}`);
    console.log(`\nMiami Alliance 3PL - MCP Server`);
    console.log(`================================`);
    console.log(`Port: ${CONFIG.port}`);
    console.log(`Project: ${CONFIG.projectRoot}`);
    console.log(`State: ${CONFIG.stateFile}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /tools  - List available tools`);
    console.log(`  POST /run    - Execute a tool`);
    console.log(`  GET  /health - Quick health check`);
    console.log(`  GET  /state  - Get system state`);
    console.log(`\nExample:`);
    console.log(`  curl http://localhost:${CONFIG.port}/tools`);
    console.log(`  curl -X POST http://localhost:${CONFIG.port}/run -d '{"tool":"diagnose.full"}'`);
});

// Handle shutdown
process.on('SIGINT', () => {
    log('INFO', 'MCP-001', 'Shutting down...');
    saveState();
    process.exit(0);
});
