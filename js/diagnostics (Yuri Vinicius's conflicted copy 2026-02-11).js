/**
 * Miami Alliance 3PL - Advanced Self-Diagnostics System
 * @module diagnostics
 * @version 2.0.0
 * @description Comprehensive self-testing, monitoring, and diagnostic capabilities
 *
 * SECTION IDs:
 * - DIAG-001: Core Diagnostics Engine
 * - DIAG-002: Firebase Tests
 * - DIAG-003: Authentication Tests
 * - DIAG-004: Firestore Tests
 * - DIAG-005: UI Component Tests
 * - DIAG-006: Performance Tests
 * - DIAG-007: Network Tests
 * - DIAG-008: Security Tests
 * - DIAG-009: Reporting Engine
 * - DIAG-010: Auto-Healing
 */

// ============================================================
// DIAG-001: CORE DIAGNOSTICS ENGINE
// ============================================================

class DiagnosticsEngine {
    constructor() {
        this.version = '2.0.0';
        this.results = [];
        this.startTime = null;
        this.endTime = null;
        this.listeners = [];
        this.autoHealEnabled = true;
        this.testRegistry = new Map();

        // Register all test suites
        this.registerTestSuite('firebase', new FirebaseTestSuite());
        this.registerTestSuite('auth', new AuthTestSuite());
        this.registerTestSuite('firestore', new FirestoreTestSuite());
        this.registerTestSuite('ui', new UITestSuite());
        this.registerTestSuite('performance', new PerformanceTestSuite());
        this.registerTestSuite('network', new NetworkTestSuite());
        this.registerTestSuite('security', new SecurityTestSuite());
    }

    registerTestSuite(name, suite) {
        this.testRegistry.set(name, suite);
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    emit(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }

    /**
     * Run all diagnostic tests
     * @returns {Promise<DiagnosticReport>}
     */
    async runFullDiagnostics() {
        this.startTime = performance.now();
        this.results = [];
        this.emit('start', { timestamp: new Date().toISOString() });

        console.group('%c[DIAG-001] Running Full Diagnostics', 'color: #3b82f6; font-weight: bold;');

        for (const [name, suite] of this.testRegistry) {
            this.emit('suite-start', { name });
            console.group(`%c[${name.toUpperCase()}] Test Suite`, 'color: #8b5cf6;');

            try {
                const suiteResults = await suite.runAll();
                this.results.push(...suiteResults);

                // Auto-heal if enabled
                if (this.autoHealEnabled) {
                    for (const result of suiteResults) {
                        if (result.status === 'fail' && result.autoHeal) {
                            await this.attemptAutoHeal(result);
                        }
                    }
                }
            } catch (error) {
                this.results.push({
                    id: `${name}-error`,
                    name: `${name} Suite Error`,
                    status: 'error',
                    message: error.message,
                    stack: error.stack
                });
            }

            console.groupEnd();
            this.emit('suite-end', { name });
        }

        this.endTime = performance.now();
        console.groupEnd();

        const report = this.generateReport();
        this.emit('complete', report);

        return report;
    }

    /**
     * Run specific test suite
     * @param {string} suiteName
     * @returns {Promise<Array>}
     */
    async runSuite(suiteName) {
        const suite = this.testRegistry.get(suiteName);
        if (!suite) {
            throw new Error(`Unknown test suite: ${suiteName}`);
        }
        return await suite.runAll();
    }

    /**
     * Attempt auto-healing for failed test
     * @param {object} result
     */
    async attemptAutoHeal(result) {
        console.log(`%c[DIAG-010] Attempting auto-heal for: ${result.name}`, 'color: #f59e0b;');
        try {
            await result.autoHeal();
            result.healed = true;
            console.log(`%c[DIAG-010] Auto-heal successful`, 'color: #10b981;');
        } catch (error) {
            result.healError = error.message;
            console.log(`%c[DIAG-010] Auto-heal failed: ${error.message}`, 'color: #ef4444;');
        }
    }

    /**
     * Generate diagnostic report
     * @returns {DiagnosticReport}
     */
    generateReport() {
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        const warnings = this.results.filter(r => r.status === 'warning').length;
        const errors = this.results.filter(r => r.status === 'error').length;

        return {
            id: `diag-${Date.now()}`,
            version: this.version,
            timestamp: new Date().toISOString(),
            duration: Math.round(this.endTime - this.startTime),
            summary: {
                total: this.results.length,
                passed,
                failed,
                warnings,
                errors,
                score: Math.round((passed / this.results.length) * 100),
                status: failed > 0 || errors > 0 ? 'ISSUES_FOUND' : warnings > 0 ? 'WARNINGS' : 'HEALTHY'
            },
            results: this.results,
            recommendations: this.generateRecommendations(),
            environment: this.captureEnvironment()
        };
    }

    generateRecommendations() {
        const recs = [];

        for (const result of this.results) {
            if (result.status === 'fail' || result.status === 'warning') {
                if (result.recommendation) {
                    recs.push({
                        test: result.name,
                        priority: result.status === 'fail' ? 'high' : 'medium',
                        action: result.recommendation
                    });
                }
            }
        }

        return recs;
    }

    captureEnvironment() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            online: navigator.onLine,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            referrer: document.referrer,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================================
// DIAG-002: FIREBASE TESTS
// ============================================================

class FirebaseTestSuite {
    async runAll() {
        const results = [];

        results.push(await this.testFirebaseLoaded());
        results.push(await this.testFirebaseConfig());
        results.push(await this.testFirebaseApp());

        return results;
    }

    async testFirebaseLoaded() {
        const test = {
            id: 'DIAG-002-001',
            name: 'Firebase SDK Loaded',
            status: 'pass',
            details: []
        };

        try {
            // Check if Firebase modules can be imported
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            test.details.push('Firebase App SDK loaded successfully');
        } catch (error) {
            test.status = 'fail';
            test.message = 'Failed to load Firebase SDK';
            test.recommendation = 'Check internet connection and Firebase CDN availability';
        }

        return test;
    }

    async testFirebaseConfig() {
        const test = {
            id: 'DIAG-002-002',
            name: 'Firebase Configuration',
            status: 'pass',
            details: []
        };

        const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

        try {
            // Try to import our firebase module
            const firebaseModule = await import('./firebase.js');
            const config = firebaseModule.FIREBASE_CONFIG;

            for (const key of requiredKeys) {
                if (!config[key]) {
                    test.status = 'fail';
                    test.details.push(`Missing config key: ${key}`);
                } else {
                    test.details.push(`${key}: present`);
                }
            }
        } catch (error) {
            test.status = 'warning';
            test.message = 'Could not verify Firebase config module';
            test.details.push('Using inline config (fallback)');
        }

        return test;
    }

    async testFirebaseApp() {
        const test = {
            id: 'DIAG-002-003',
            name: 'Firebase App Initialization',
            status: 'pass',
            details: []
        };

        try {
            const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

            const apps = getApps();
            if (apps.length > 0) {
                test.details.push(`Firebase app initialized: ${apps[0].name}`);
            } else {
                test.status = 'warning';
                test.details.push('No Firebase app initialized yet');
            }
        } catch (error) {
            test.status = 'fail';
            test.message = error.message;
        }

        return test;
    }
}

// ============================================================
// DIAG-003: AUTHENTICATION TESTS
// ============================================================

class AuthTestSuite {
    async runAll() {
        const results = [];

        results.push(await this.testAuthService());
        results.push(await this.testAuthState());
        results.push(await this.testAuthPersistence());

        return results;
    }

    async testAuthService() {
        const test = {
            id: 'DIAG-003-001',
            name: 'Auth Service Available',
            status: 'pass',
            details: []
        };

        try {
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

            let app = getApps()[0];
            if (!app) {
                // Initialize for testing
                app = initializeApp({
                    apiKey: "AIzaSyA4wMm8-QmZGt3lJcZgTpbBa1W_TklrmRg",
                    authDomain: "miamialliance3pl.firebaseapp.com",
                    projectId: "miamialliance3pl"
                });
            }

            const auth = getAuth(app);
            test.details.push('Auth service initialized');
            test.details.push(`Current user: ${auth.currentUser ? auth.currentUser.email : 'none'}`);
        } catch (error) {
            test.status = 'fail';
            test.message = error.message;
        }

        return test;
    }

    async testAuthState() {
        const test = {
            id: 'DIAG-003-002',
            name: 'Auth State',
            status: 'pass',
            details: []
        };

        try {
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

            const app = getApps()[0];
            if (app) {
                const auth = getAuth(app);
                if (auth.currentUser) {
                    test.details.push(`Logged in as: ${auth.currentUser.email}`);
                    test.details.push(`UID: ${auth.currentUser.uid}`);
                    test.details.push(`Email verified: ${auth.currentUser.emailVerified}`);
                } else {
                    test.status = 'info';
                    test.details.push('No user logged in');
                }
            }
        } catch (error) {
            test.status = 'fail';
            test.message = error.message;
        }

        return test;
    }

    async testAuthPersistence() {
        const test = {
            id: 'DIAG-003-003',
            name: 'Auth Persistence',
            status: 'pass',
            details: []
        };

        // Check local storage for Firebase auth
        const authKeys = Object.keys(localStorage).filter(k => k.includes('firebase'));
        test.details.push(`Firebase storage keys: ${authKeys.length}`);

        if (authKeys.length === 0) {
            test.status = 'info';
            test.details.push('No auth persistence data found');
        }

        return test;
    }
}

// ============================================================
// DIAG-004: FIRESTORE TESTS
// ============================================================

class FirestoreTestSuite {
    async runAll() {
        const results = [];

        results.push(await this.testFirestoreConnection());
        results.push(await this.testFirestoreRead());
        results.push(await this.testFirestoreCollections());

        return results;
    }

    async testFirestoreConnection() {
        const test = {
            id: 'DIAG-004-001',
            name: 'Firestore Connection',
            status: 'pass',
            details: []
        };

        try {
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

            const app = getApps()[0];
            if (app) {
                const db = getFirestore(app);
                test.details.push('Firestore initialized');
                test.details.push(`Project: ${app.options.projectId}`);
            } else {
                test.status = 'warning';
                test.details.push('Firebase app not initialized');
            }
        } catch (error) {
            test.status = 'fail';
            test.message = error.message;
        }

        return test;
    }

    async testFirestoreRead() {
        const test = {
            id: 'DIAG-004-002',
            name: 'Firestore Read Access',
            status: 'pass',
            details: [],
            timing: 0
        };

        try {
            const { getFirestore, collection, getDocs, limit, query } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

            const app = getApps()[0];
            if (!app) {
                test.status = 'skip';
                test.details.push('Firebase app not initialized');
                return test;
            }

            const db = getFirestore(app);
            const start = performance.now();

            // Try to read settings (public collection)
            const q = query(collection(db, 'settings'), limit(1));
            await getDocs(q);

            test.timing = Math.round(performance.now() - start);
            test.details.push(`Read successful (${test.timing}ms)`);

            if (test.timing > 2000) {
                test.status = 'warning';
                test.details.push('Slow response time');
                test.recommendation = 'Check network connection or Firestore indexing';
            }
        } catch (error) {
            if (error.code === 'permission-denied') {
                test.status = 'info';
                test.details.push('Read blocked by security rules (expected for unauthenticated)');
            } else {
                test.status = 'fail';
                test.message = error.message;
            }
        }

        return test;
    }

    async testFirestoreCollections() {
        const test = {
            id: 'DIAG-004-003',
            name: 'Firestore Collections Schema',
            status: 'pass',
            details: [],
            collections: []
        };

        const expectedCollections = [
            { name: 'users', fields: ['email', 'role', 'name'] },
            { name: 'shipments', fields: ['tracking_number', 'status', 'user_id'] },
            { name: 'inventory', fields: ['sku', 'quantity', 'user_id'] },
            { name: 'invoices', fields: ['invoice_number', 'total', 'status'] },
            { name: 'settings', fields: [] },
            { name: 'storage_snapshots', fields: ['customer_id', 'date', 'pallet_count'] },
            { name: 'billable_events', fields: ['event_type', 'customer_id', 'invoiced'] },
            { name: 'pending_invites', fields: ['email', 'role', 'invited_at'] }
        ];

        test.collections = expectedCollections;
        test.details.push(`${expectedCollections.length} collections defined`);

        return test;
    }
}

// ============================================================
// DIAG-005: UI COMPONENT TESTS
// ============================================================

class UITestSuite {
    async runAll() {
        const results = [];

        results.push(this.testDOMStructure());
        results.push(this.testCSSLoaded());
        results.push(this.testAccessibility());
        results.push(this.testResponsive());

        return results;
    }

    testDOMStructure() {
        const test = {
            id: 'DIAG-005-001',
            name: 'DOM Structure',
            status: 'pass',
            details: [],
            elements: {}
        };

        const requiredElements = [
            { selector: 'header.header', name: 'Header' },
            { selector: '.nav', name: 'Navigation' },
            { selector: '.portal-sidebar', name: 'Sidebar' },
            { selector: '.portal-main', name: 'Main Content' },
            { selector: '#logout-btn', name: 'Logout Button' },
            { selector: '#user-name', name: 'User Name Display' }
        ];

        for (const el of requiredElements) {
            const found = document.querySelector(el.selector);
            test.elements[el.name] = !!found;

            if (found) {
                test.details.push(`${el.name}: found`);
            } else {
                test.status = 'warning';
                test.details.push(`${el.name}: missing`);
            }
        }

        return test;
    }

    testCSSLoaded() {
        const test = {
            id: 'DIAG-005-002',
            name: 'CSS Stylesheets',
            status: 'pass',
            details: []
        };

        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        test.details.push(`${stylesheets.length} stylesheets loaded`);

        stylesheets.forEach((sheet, i) => {
            test.details.push(`  ${i + 1}. ${sheet.href.split('/').pop()}`);
        });

        // Check for CSS variables
        const rootStyles = getComputedStyle(document.documentElement);
        const primaryColor = rootStyles.getPropertyValue('--color-primary');

        if (primaryColor) {
            test.details.push(`Primary color: ${primaryColor.trim()}`);
        } else {
            test.status = 'warning';
            test.details.push('CSS variables not found');
        }

        return test;
    }

    testAccessibility() {
        const test = {
            id: 'DIAG-005-003',
            name: 'Accessibility',
            status: 'pass',
            details: [],
            issues: []
        };

        // Check for alt text on images
        const images = document.querySelectorAll('img');
        const imagesWithoutAlt = [...images].filter(img => !img.alt);
        if (imagesWithoutAlt.length > 0) {
            test.issues.push(`${imagesWithoutAlt.length} images without alt text`);
        }

        // Check for form labels
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        let unlabeledInputs = 0;
        inputs.forEach(input => {
            const id = input.id;
            if (id && !document.querySelector(`label[for="${id}"]`)) {
                unlabeledInputs++;
            }
        });
        if (unlabeledInputs > 0) {
            test.issues.push(`${unlabeledInputs} form fields without labels`);
        }

        // Check for button text
        const buttons = document.querySelectorAll('button');
        const emptyButtons = [...buttons].filter(btn => !btn.textContent.trim() && !btn.getAttribute('aria-label'));
        if (emptyButtons.length > 0) {
            test.issues.push(`${emptyButtons.length} buttons without text or aria-label`);
        }

        if (test.issues.length > 0) {
            test.status = 'warning';
            test.details = test.issues;
            test.recommendation = 'Address accessibility issues for better user experience';
        } else {
            test.details.push('No major accessibility issues found');
        }

        return test;
    }

    testResponsive() {
        const test = {
            id: 'DIAG-005-004',
            name: 'Responsive Design',
            status: 'pass',
            details: []
        };

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        test.details.push(`Viewport: ${viewportWidth}x${viewportHeight}`);

        if (viewportWidth < 768) {
            test.details.push('Device: Mobile');
        } else if (viewportWidth < 1024) {
            test.details.push('Device: Tablet');
        } else {
            test.details.push('Device: Desktop');
        }

        // Check for viewport meta tag
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            test.details.push('Viewport meta tag: present');
        } else {
            test.status = 'warning';
            test.details.push('Viewport meta tag: missing');
            test.recommendation = 'Add viewport meta tag for proper mobile rendering';
        }

        return test;
    }
}

// ============================================================
// DIAG-006: PERFORMANCE TESTS
// ============================================================

class PerformanceTestSuite {
    async runAll() {
        const results = [];

        results.push(this.testPageLoad());
        results.push(this.testMemory());
        results.push(this.testResources());

        return results;
    }

    testPageLoad() {
        const test = {
            id: 'DIAG-006-001',
            name: 'Page Load Performance',
            status: 'pass',
            details: [],
            metrics: {}
        };

        if (window.performance && performance.timing) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
            const firstByte = timing.responseStart - timing.navigationStart;

            test.metrics = {
                loadTime: loadTime > 0 ? loadTime : 'N/A',
                domReady: domReady > 0 ? domReady : 'N/A',
                firstByte: firstByte > 0 ? firstByte : 'N/A'
            };

            test.details.push(`Page Load: ${test.metrics.loadTime}ms`);
            test.details.push(`DOM Ready: ${test.metrics.domReady}ms`);
            test.details.push(`First Byte: ${test.metrics.firstByte}ms`);

            if (loadTime > 3000) {
                test.status = 'warning';
                test.recommendation = 'Page load time exceeds 3 seconds - consider optimization';
            }
        } else {
            test.details.push('Performance API not available');
        }

        return test;
    }

    testMemory() {
        const test = {
            id: 'DIAG-006-002',
            name: 'Memory Usage',
            status: 'pass',
            details: []
        };

        if (performance.memory) {
            const mb = bytes => Math.round(bytes / 1024 / 1024);
            test.details.push(`Used: ${mb(performance.memory.usedJSHeapSize)} MB`);
            test.details.push(`Total: ${mb(performance.memory.totalJSHeapSize)} MB`);
            test.details.push(`Limit: ${mb(performance.memory.jsHeapSizeLimit)} MB`);

            const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            if (usage > 0.8) {
                test.status = 'warning';
                test.recommendation = 'High memory usage detected';
            }
        } else {
            test.details.push('Memory API not available (Chrome only)');
        }

        return test;
    }

    testResources() {
        const test = {
            id: 'DIAG-006-003',
            name: 'Resource Loading',
            status: 'pass',
            details: [],
            resources: []
        };

        if (performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            const byType = {};

            resources.forEach(r => {
                const type = r.initiatorType || 'other';
                byType[type] = (byType[type] || 0) + 1;
            });

            test.details.push(`Total resources: ${resources.length}`);
            for (const [type, count] of Object.entries(byType)) {
                test.details.push(`  ${type}: ${count}`);
            }

            // Check for slow resources
            const slowResources = resources.filter(r => r.duration > 1000);
            if (slowResources.length > 0) {
                test.status = 'warning';
                test.details.push(`${slowResources.length} slow resources (>1s)`);
            }
        }

        return test;
    }
}

// ============================================================
// DIAG-007: NETWORK TESTS
// ============================================================

class NetworkTestSuite {
    async runAll() {
        const results = [];

        results.push(this.testOnlineStatus());
        results.push(await this.testFirebaseCDN());
        results.push(this.testConnectionType());

        return results;
    }

    testOnlineStatus() {
        const test = {
            id: 'DIAG-007-001',
            name: 'Online Status',
            status: navigator.onLine ? 'pass' : 'fail',
            details: [navigator.onLine ? 'Browser is online' : 'Browser is offline']
        };

        if (!navigator.onLine) {
            test.recommendation = 'Check internet connection';
        }

        return test;
    }

    async testFirebaseCDN() {
        const test = {
            id: 'DIAG-007-002',
            name: 'Firebase CDN',
            status: 'pass',
            details: [],
            timing: 0
        };

        try {
            const start = performance.now();
            const response = await fetch('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            test.timing = Math.round(performance.now() - start);

            if (response.ok) {
                test.details.push(`Firebase CDN reachable (${test.timing}ms)`);
                if (test.timing > 1000) {
                    test.status = 'warning';
                    test.details.push('Slow CDN response');
                }
            } else {
                test.status = 'fail';
                test.details.push(`CDN returned ${response.status}`);
            }
        } catch (error) {
            test.status = 'fail';
            test.message = error.message;
            test.recommendation = 'Check network connection or firewall settings';
        }

        return test;
    }

    testConnectionType() {
        const test = {
            id: 'DIAG-007-003',
            name: 'Connection Type',
            status: 'pass',
            details: []
        };

        if (navigator.connection) {
            const conn = navigator.connection;
            test.details.push(`Type: ${conn.effectiveType || 'unknown'}`);
            test.details.push(`Downlink: ${conn.downlink || 'unknown'} Mbps`);
            test.details.push(`RTT: ${conn.rtt || 'unknown'} ms`);
            test.details.push(`Save Data: ${conn.saveData ? 'enabled' : 'disabled'}`);

            if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
                test.status = 'warning';
                test.recommendation = 'Slow network connection detected';
            }
        } else {
            test.details.push('Network Information API not available');
        }

        return test;
    }
}

// ============================================================
// DIAG-008: SECURITY TESTS
// ============================================================

class SecurityTestSuite {
    async runAll() {
        const results = [];

        results.push(this.testHTTPS());
        results.push(this.testSecurityHeaders());
        results.push(this.testLocalStorage());
        results.push(this.testXSS());

        return results;
    }

    testHTTPS() {
        const test = {
            id: 'DIAG-008-001',
            name: 'HTTPS',
            status: window.location.protocol === 'https:' ? 'pass' : 'warning',
            details: [`Protocol: ${window.location.protocol}`]
        };

        if (test.status === 'warning') {
            test.recommendation = 'Use HTTPS for production';
        }

        return test;
    }

    testSecurityHeaders() {
        const test = {
            id: 'DIAG-008-002',
            name: 'Security Best Practices',
            status: 'pass',
            details: []
        };

        // Check for potentially sensitive data in URL
        if (window.location.search.includes('password') || window.location.search.includes('token')) {
            test.status = 'warning';
            test.details.push('Sensitive data may be in URL');
        }

        // Check for mixed content warnings
        const scripts = document.querySelectorAll('script[src^="http:"]');
        const links = document.querySelectorAll('link[href^="http:"]');

        if (scripts.length > 0 || links.length > 0) {
            test.status = 'warning';
            test.details.push(`Mixed content: ${scripts.length} scripts, ${links.length} stylesheets`);
        } else {
            test.details.push('No mixed content detected');
        }

        return test;
    }

    testLocalStorage() {
        const test = {
            id: 'DIAG-008-003',
            name: 'Local Storage Security',
            status: 'pass',
            details: []
        };

        const sensitivePatterns = ['password', 'secret', 'token', 'key', 'auth'];
        const storageKeys = Object.keys(localStorage);

        test.details.push(`${storageKeys.length} items in localStorage`);

        const suspiciousKeys = storageKeys.filter(key =>
            sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))
        );

        if (suspiciousKeys.length > 0) {
            test.status = 'info';
            test.details.push(`${suspiciousKeys.length} potentially sensitive keys found`);
        }

        return test;
    }

    testXSS() {
        const test = {
            id: 'DIAG-008-004',
            name: 'XSS Prevention',
            status: 'pass',
            details: []
        };

        // Check for innerHTML usage in URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        let potentialXSS = false;

        for (const [key, value] of urlParams) {
            if (value.includes('<') || value.includes('>') || value.includes('javascript:')) {
                potentialXSS = true;
            }
        }

        if (potentialXSS) {
            test.status = 'warning';
            test.details.push('Potential XSS vectors in URL parameters');
            test.recommendation = 'Sanitize all user input before rendering';
        } else {
            test.details.push('No obvious XSS vectors detected');
        }

        return test;
    }
}

// ============================================================
// DIAG-009: REPORTING ENGINE
// ============================================================

class ReportingEngine {
    static formatReport(report) {
        const lines = [];

        lines.push('╔══════════════════════════════════════════════════════════════╗');
        lines.push('║          MIAMI ALLIANCE 3PL - DIAGNOSTIC REPORT              ║');
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push(`║ ID: ${report.id.padEnd(55)} ║`);
        lines.push(`║ Time: ${report.timestamp.padEnd(53)} ║`);
        lines.push(`║ Duration: ${(report.duration + 'ms').padEnd(49)} ║`);
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ SUMMARY                                                      ║');
        lines.push(`║   Status: ${report.summary.status.padEnd(49)} ║`);
        lines.push(`║   Score: ${(report.summary.score + '%').padEnd(50)} ║`);
        lines.push(`║   Passed: ${String(report.summary.passed).padEnd(49)} ║`);
        lines.push(`║   Failed: ${String(report.summary.failed).padEnd(49)} ║`);
        lines.push(`║   Warnings: ${String(report.summary.warnings).padEnd(47)} ║`);
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ TEST RESULTS                                                 ║');

        for (const result of report.results) {
            const statusIcon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
            const line = `║ ${statusIcon} [${result.id}] ${result.name}`;
            lines.push(line.padEnd(63) + '║');
        }

        if (report.recommendations.length > 0) {
            lines.push('╠══════════════════════════════════════════════════════════════╣');
            lines.push('║ RECOMMENDATIONS                                              ║');
            for (const rec of report.recommendations) {
                const line = `║   • ${rec.action}`;
                lines.push(line.substring(0, 63).padEnd(63) + '║');
            }
        }

        lines.push('╚══════════════════════════════════════════════════════════════╝');

        return lines.join('\n');
    }

    static toHTML(report) {
        return `
        <div class="diagnostic-report">
            <h2>Diagnostic Report</h2>
            <div class="report-summary">
                <div class="status ${report.summary.status.toLowerCase()}">${report.summary.status}</div>
                <div class="score">${report.summary.score}%</div>
                <div class="stats">
                    <span class="passed">${report.summary.passed} passed</span>
                    <span class="failed">${report.summary.failed} failed</span>
                    <span class="warnings">${report.summary.warnings} warnings</span>
                </div>
            </div>
            <div class="results">
                ${report.results.map(r => `
                    <div class="result ${r.status}">
                        <span class="id">${r.id}</span>
                        <span class="name">${r.name}</span>
                        <span class="status-icon">${r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠'}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    static toJSON(report) {
        return JSON.stringify(report, null, 2);
    }
}

// ============================================================
// DIAG-010: AUTO-HEALING
// ============================================================

const autoHealers = {
    'DIAG-002-001': async () => {
        // Reload Firebase SDK
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    },

    'DIAG-007-001': async () => {
        // Wait for online status
        return new Promise((resolve, reject) => {
            if (navigator.onLine) {
                resolve();
            } else {
                const handler = () => {
                    window.removeEventListener('online', handler);
                    resolve();
                };
                window.addEventListener('online', handler);
                setTimeout(() => reject(new Error('Timeout waiting for network')), 10000);
            }
        });
    }
};

// ============================================================
// EXPORTS & GLOBAL REGISTRATION
// ============================================================

const diagnostics = new DiagnosticsEngine();

// Make available globally
window.MA3PL_Diagnostics = diagnostics;
window.MA3PL_ReportingEngine = ReportingEngine;

// Console command
window.runDiagnostics = async () => {
    const report = await diagnostics.runFullDiagnostics();
    console.log(ReportingEngine.formatReport(report));
    return report;
};

export {
    DiagnosticsEngine,
    ReportingEngine,
    diagnostics
};
