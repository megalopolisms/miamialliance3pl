#!/usr/bin/env node
/**
 * Miami Alliance 3PL - MCP Server
 * @module mcp-server
 * @version 1.0.0
 * @description Model Context Protocol server for maintaining system state, diagnostics, and tools
 *
 * SECTION IDs:
 * - MCP-001: Server Configuration
 * - MCP-002: Tool Definitions
 * - MCP-003: Diagnostic Tools
 * - MCP-004: Database Tools
 * - MCP-005: Code Integrity Tools
 * - MCP-006: Context Management
 * - MCP-007: Health Monitoring
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// MCP-001: SERVER CONFIGURATION
// ============================================================

const CONFIG = {
    port: process.env.MCP_PORT || 3847,
    projectRoot: path.resolve(__dirname, '..'),
    logFile: path.resolve(__dirname, 'mcp.log'),
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

function log(level, sectionId, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] [${sectionId}] ${message}\n`;
    fs.appendFileSync(CONFIG.logFile, logLine);
    console.log(logLine.trim());
}

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
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
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
