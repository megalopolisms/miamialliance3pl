/**
 * Miami Alliance 3PL - Firebase Admin Controller
 * @module firebase-admin
 * @version 1.0.0
 * @description Full Firebase control via MCP - database, users, permissions, configs
 *
 * SECTION IDs:
 * - FA-001: Firebase Admin Initialization
 * - FA-002: Firestore Database Operations
 * - FA-003: User Management
 * - FA-004: Security Rules Management
 * - FA-005: Configuration Management
 * - FA-006: Backup & Restore
 * - FA-007: Real-time Monitoring
 * - FA-008: Batch Operations
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ============================================================
// FA-001: FIREBASE ADMIN INITIALIZATION
// ============================================================

class FirebaseAdminController {
    constructor(options = {}) {
        this.projectId = options.projectId || 'miamialliance3pl';
        this.initialized = false;
        this.db = null;
        this.auth = null;
        this.configPath = path.join(__dirname, 'firebase-config.json');
        this.backupDir = path.join(__dirname, 'backups');
        this.rulesPath = path.join(__dirname, '..', 'firestore.rules');
    }

    /**
     * Initialize Firebase Admin SDK
     */
    async initialize(serviceAccountPath = null) {
        if (this.initialized) {
            return { success: true, message: 'Already initialized' };
        }

        try {
            let credential;

            if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                credential = admin.credential.cert(serviceAccount);
            } else {
                // Try application default credentials
                credential = admin.credential.applicationDefault();
            }

            admin.initializeApp({
                credential,
                projectId: this.projectId,
                databaseURL: `https://${this.projectId}.firebaseio.com`
            });

            this.db = admin.firestore();
            this.auth = admin.auth();
            this.initialized = true;

            // Ensure backup directory exists
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }

            return { success: true, message: 'Firebase Admin initialized', projectId: this.projectId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Firebase Admin not initialized. Call initialize() first.');
        }
    }
}

// ============================================================
// FA-002: FIRESTORE DATABASE OPERATIONS
// ============================================================

class FirestoreController extends FirebaseAdminController {

    /**
     * List all collections in the database
     */
    async listCollections() {
        this.ensureInitialized();
        const collections = await this.db.listCollections();
        return {
            collections: collections.map(c => ({
                id: c.id,
                path: c.path
            }))
        };
    }

    /**
     * Get collection stats (document count, sample data)
     */
    async getCollectionStats(collectionName) {
        this.ensureInitialized();
        const snapshot = await this.db.collection(collectionName).get();
        const docs = [];
        let sampleDoc = null;

        snapshot.forEach((doc, index) => {
            docs.push({ id: doc.id });
            if (index === 0) {
                sampleDoc = { id: doc.id, fields: Object.keys(doc.data()) };
            }
        });

        return {
            collection: collectionName,
            documentCount: docs.length,
            sampleDocument: sampleDoc,
            documentIds: docs.slice(0, 10) // First 10 IDs
        };
    }

    /**
     * Query documents with filters
     */
    async queryDocuments(collectionName, options = {}) {
        this.ensureInitialized();
        let query = this.db.collection(collectionName);

        // Apply filters
        if (options.where) {
            for (const condition of options.where) {
                query = query.where(condition.field, condition.op, condition.value);
            }
        }

        // Apply ordering
        if (options.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }

        // Apply limit
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        const documents = [];
        snapshot.forEach(doc => {
            documents.push({ id: doc.id, ...doc.data() });
        });

        return { collection: collectionName, count: documents.length, documents };
    }

    /**
     * Get a single document
     */
    async getDocument(collectionName, documentId) {
        this.ensureInitialized();
        const doc = await this.db.collection(collectionName).doc(documentId).get();

        if (!doc.exists) {
            return { exists: false, id: documentId };
        }

        return { exists: true, id: doc.id, data: doc.data() };
    }

    /**
     * Create a new document
     */
    async createDocument(collectionName, data, documentId = null) {
        this.ensureInitialized();
        const timestamp = new Date().toISOString();
        const docData = { ...data, created_at: timestamp, updated_at: timestamp };

        let docRef;
        if (documentId) {
            docRef = this.db.collection(collectionName).doc(documentId);
            await docRef.set(docData);
        } else {
            docRef = await this.db.collection(collectionName).add(docData);
        }

        return { success: true, id: docRef.id, collection: collectionName };
    }

    /**
     * Update a document
     */
    async updateDocument(collectionName, documentId, data, merge = true) {
        this.ensureInitialized();
        const docRef = this.db.collection(collectionName).doc(documentId);
        const updateData = { ...data, updated_at: new Date().toISOString() };

        if (merge) {
            await docRef.set(updateData, { merge: true });
        } else {
            await docRef.update(updateData);
        }

        return { success: true, id: documentId, collection: collectionName };
    }

    /**
     * Delete a document
     */
    async deleteDocument(collectionName, documentId) {
        this.ensureInitialized();
        await this.db.collection(collectionName).doc(documentId).delete();
        return { success: true, deleted: documentId, collection: collectionName };
    }

    /**
     * Delete all documents in a collection
     */
    async deleteCollection(collectionName, batchSize = 100) {
        this.ensureInitialized();
        const collectionRef = this.db.collection(collectionName);
        const query = collectionRef.limit(batchSize);

        let deleted = 0;
        let snapshot = await query.get();

        while (!snapshot.empty) {
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deleted++;
            });
            await batch.commit();
            snapshot = await query.get();
        }

        return { success: true, collection: collectionName, deletedCount: deleted };
    }

    /**
     * Create or update settings document
     */
    async setSettings(settingsKey, data) {
        this.ensureInitialized();
        const docRef = this.db.collection('settings').doc(settingsKey);
        await docRef.set({
            ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return { success: true, settings: settingsKey };
    }

    /**
     * Get all settings
     */
    async getAllSettings() {
        this.ensureInitialized();
        const snapshot = await this.db.collection('settings').get();
        const settings = {};
        snapshot.forEach(doc => {
            settings[doc.id] = doc.data();
        });
        return settings;
    }
}

// ============================================================
// FA-003: USER MANAGEMENT
// ============================================================

class UserController extends FirebaseAdminController {

    /**
     * List all users with pagination
     */
    async listUsers(maxResults = 100, pageToken = null) {
        this.ensureInitialized();
        const listUsersResult = await this.auth.listUsers(maxResults, pageToken);

        return {
            users: listUsersResult.users.map(user => ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                disabled: user.disabled,
                emailVerified: user.emailVerified,
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime
            })),
            pageToken: listUsersResult.pageToken,
            hasMore: !!listUsersResult.pageToken
        };
    }

    /**
     * Get user by UID
     */
    async getUser(uid) {
        this.ensureInitialized();
        const user = await this.auth.getUser(uid);
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            photoURL: user.photoURL,
            disabled: user.disabled,
            emailVerified: user.emailVerified,
            metadata: user.metadata,
            customClaims: user.customClaims
        };
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        this.ensureInitialized();
        const user = await this.auth.getUserByEmail(email);
        return this.getUser(user.uid);
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        this.ensureInitialized();
        const user = await this.auth.createUser({
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
            phoneNumber: userData.phoneNumber,
            emailVerified: userData.emailVerified || false,
            disabled: userData.disabled || false
        });

        // Create Firestore user document
        if (userData.role) {
            await this.db.collection('users').doc(user.uid).set({
                email: userData.email,
                name: userData.displayName,
                role: userData.role,
                created_at: new Date().toISOString()
            });
        }

        return { success: true, uid: user.uid, email: user.email };
    }

    /**
     * Update user properties
     */
    async updateUser(uid, updates) {
        this.ensureInitialized();
        const updateData = {};

        if (updates.email) updateData.email = updates.email;
        if (updates.displayName) updateData.displayName = updates.displayName;
        if (updates.phoneNumber) updateData.phoneNumber = updates.phoneNumber;
        if (updates.photoURL) updateData.photoURL = updates.photoURL;
        if (updates.password) updateData.password = updates.password;
        if (typeof updates.disabled === 'boolean') updateData.disabled = updates.disabled;
        if (typeof updates.emailVerified === 'boolean') updateData.emailVerified = updates.emailVerified;

        await this.auth.updateUser(uid, updateData);

        // Update Firestore document if role changed
        if (updates.role) {
            await this.db.collection('users').doc(uid).set({
                role: updates.role,
                updated_at: new Date().toISOString()
            }, { merge: true });
        }

        return { success: true, uid, updated: Object.keys(updateData) };
    }

    /**
     * Delete a user
     */
    async deleteUser(uid) {
        this.ensureInitialized();
        await this.auth.deleteUser(uid);

        // Also delete Firestore document
        try {
            await this.db.collection('users').doc(uid).delete();
        } catch (e) {
            // Ignore if doc doesn't exist
        }

        return { success: true, deleted: uid };
    }

    /**
     * Disable a user
     */
    async disableUser(uid) {
        return this.updateUser(uid, { disabled: true });
    }

    /**
     * Enable a user
     */
    async enableUser(uid) {
        return this.updateUser(uid, { disabled: false });
    }

    /**
     * Set custom claims (for roles/permissions)
     */
    async setCustomClaims(uid, claims) {
        this.ensureInitialized();
        await this.auth.setCustomUserClaims(uid, claims);
        return { success: true, uid, claims };
    }

    /**
     * Set user role (updates both Auth claims and Firestore)
     */
    async setUserRole(uid, role) {
        this.ensureInitialized();

        // Set custom claim
        await this.auth.setCustomUserClaims(uid, { role });

        // Update Firestore
        await this.db.collection('users').doc(uid).set({
            role,
            updated_at: new Date().toISOString()
        }, { merge: true });

        return { success: true, uid, role };
    }

    /**
     * Revoke refresh tokens (force re-login)
     */
    async revokeTokens(uid) {
        this.ensureInitialized();
        await this.auth.revokeRefreshTokens(uid);
        return { success: true, uid, message: 'Tokens revoked - user must re-login' };
    }

    /**
     * Generate password reset link
     */
    async generatePasswordResetLink(email) {
        this.ensureInitialized();
        const link = await this.auth.generatePasswordResetLink(email);
        return { success: true, email, resetLink: link };
    }

    /**
     * Generate email verification link
     */
    async generateEmailVerificationLink(email) {
        this.ensureInitialized();
        const link = await this.auth.generateEmailVerificationLink(email);
        return { success: true, email, verificationLink: link };
    }
}

// ============================================================
// FA-004: SECURITY RULES MANAGEMENT
// ============================================================

class SecurityRulesController extends FirebaseAdminController {

    /**
     * Get current Firestore security rules
     */
    async getSecurityRules() {
        if (fs.existsSync(this.rulesPath)) {
            const rules = fs.readFileSync(this.rulesPath, 'utf8');
            return { source: 'file', path: this.rulesPath, rules };
        }
        return { source: 'none', message: 'No local rules file found' };
    }

    /**
     * Save security rules to file
     */
    async saveSecurityRules(rules) {
        // Backup existing rules
        if (fs.existsSync(this.rulesPath)) {
            const backup = `${this.rulesPath}.${Date.now()}.bak`;
            fs.copyFileSync(this.rulesPath, backup);
        }

        fs.writeFileSync(this.rulesPath, rules);
        return { success: true, path: this.rulesPath };
    }

    /**
     * Generate default security rules
     */
    generateDefaultRules() {
        return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isStaff() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'employee'];
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || isStaff());
      allow create: if isAdmin();
      allow update: if isAdmin() || isOwner(userId);
      allow delete: if isAdmin();
    }

    // Shipments collection
    match /shipments/{shipmentId} {
      allow read: if isAuthenticated() && (resource.data.user_id == request.auth.uid || isStaff());
      allow create: if isAuthenticated();
      allow update: if isStaff() || resource.data.user_id == request.auth.uid;
      allow delete: if isAdmin();
    }

    // Inventory collection
    match /inventory/{itemId} {
      allow read: if isAuthenticated() && (resource.data.user_id == request.auth.uid || isStaff());
      allow create: if isAuthenticated();
      allow update: if isStaff() || resource.data.user_id == request.auth.uid;
      allow delete: if isAdmin();
    }

    // Invoices collection
    match /invoices/{invoiceId} {
      allow read: if isAuthenticated() && (resource.data.customer_id == request.auth.uid || isStaff());
      allow create: if isStaff();
      allow update: if isStaff();
      allow delete: if isAdmin();
    }

    // Storage snapshots
    match /storage_snapshots/{snapshotId} {
      allow read: if isStaff();
      allow write: if isStaff();
    }

    // Billable events
    match /billable_events/{eventId} {
      allow read: if isAuthenticated() && (resource.data.customer_id == request.auth.uid || isStaff());
      allow write: if isStaff();
    }

    // Settings (admin only write, staff read)
    match /settings/{settingId} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }

    // Invites
    match /invites/{inviteId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAuthenticated();
      allow delete: if isAdmin();
    }
  }
}`;
    }

    /**
     * Create and save default rules
     */
    async createDefaultRules() {
        const rules = this.generateDefaultRules();
        return this.saveSecurityRules(rules);
    }
}

// ============================================================
// FA-005: CONFIGURATION MANAGEMENT
// ============================================================

class ConfigController extends FirebaseAdminController {

    /**
     * Get all configuration
     */
    async getConfig() {
        const config = {
            project: this.projectId,
            initialized: this.initialized
        };

        if (fs.existsSync(this.configPath)) {
            config.saved = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        }

        if (this.initialized) {
            config.settings = await this.getAllSettings();
        }

        return config;
    }

    /**
     * Save configuration to file
     */
    async saveConfig(config) {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        return { success: true, path: this.configPath };
    }

    /**
     * Update Firebase project settings
     */
    async updateProjectSettings(settings) {
        this.ensureInitialized();

        const updates = {};
        for (const [key, value] of Object.entries(settings)) {
            await this.db.collection('settings').doc(key).set(value, { merge: true });
            updates[key] = 'updated';
        }

        return { success: true, updates };
    }

    /**
     * Get pricing configuration
     */
    async getPricing() {
        this.ensureInitialized();
        const doc = await this.db.collection('settings').doc('pricing').get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Update pricing configuration
     */
    async updatePricing(pricing) {
        this.ensureInitialized();
        await this.db.collection('settings').doc('pricing').set({
            ...pricing,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true, message: 'Pricing updated' };
    }

    /**
     * Get Stripe configuration
     */
    async getStripeConfig() {
        this.ensureInitialized();
        const doc = await this.db.collection('settings').doc('stripe').get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Update Stripe configuration
     */
    async updateStripeConfig(config) {
        this.ensureInitialized();
        await this.db.collection('settings').doc('stripe').set({
            ...config,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true, message: 'Stripe config updated' };
    }
}

// ============================================================
// FA-006: BACKUP & RESTORE
// ============================================================

class BackupController extends FirebaseAdminController {

    /**
     * Backup a collection to JSON file
     */
    async backupCollection(collectionName) {
        this.ensureInitialized();
        const snapshot = await this.db.collection(collectionName).get();
        const documents = {};

        snapshot.forEach(doc => {
            documents[doc.id] = doc.data();
        });

        const backupFile = path.join(this.backupDir, `${collectionName}_${Date.now()}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(documents, null, 2));

        return {
            success: true,
            collection: collectionName,
            documentCount: Object.keys(documents).length,
            file: backupFile
        };
    }

    /**
     * Backup all collections
     */
    async backupAll() {
        this.ensureInitialized();
        const collections = await this.db.listCollections();
        const results = [];

        for (const collection of collections) {
            const result = await this.backupCollection(collection.id);
            results.push(result);
        }

        return { success: true, backups: results };
    }

    /**
     * Restore collection from backup
     */
    async restoreCollection(collectionName, backupFile) {
        this.ensureInitialized();

        if (!fs.existsSync(backupFile)) {
            return { success: false, error: 'Backup file not found' };
        }

        const documents = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        let restored = 0;

        for (const [docId, data] of Object.entries(documents)) {
            await this.db.collection(collectionName).doc(docId).set(data);
            restored++;
        }

        return { success: true, collection: collectionName, restored };
    }

    /**
     * List available backups
     */
    listBackups() {
        if (!fs.existsSync(this.backupDir)) {
            return { backups: [] };
        }

        const files = fs.readdirSync(this.backupDir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stats = fs.statSync(path.join(this.backupDir, f));
                const parts = f.replace('.json', '').split('_');
                return {
                    file: f,
                    collection: parts.slice(0, -1).join('_'),
                    timestamp: parseInt(parts[parts.length - 1]),
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        return { backups: files };
    }

    /**
     * Export full database snapshot
     */
    async exportDatabase() {
        this.ensureInitialized();
        const collections = await this.db.listCollections();
        const snapshot = { timestamp: Date.now(), collections: {} };

        for (const collection of collections) {
            const docs = await this.db.collection(collection.id).get();
            snapshot.collections[collection.id] = {};
            docs.forEach(doc => {
                snapshot.collections[collection.id][doc.id] = doc.data();
            });
        }

        const exportFile = path.join(this.backupDir, `full_export_${snapshot.timestamp}.json`);
        fs.writeFileSync(exportFile, JSON.stringify(snapshot, null, 2));

        return {
            success: true,
            file: exportFile,
            collections: Object.keys(snapshot.collections).length,
            totalDocuments: Object.values(snapshot.collections)
                .reduce((sum, col) => sum + Object.keys(col).length, 0)
        };
    }
}

// ============================================================
// FA-007: REAL-TIME MONITORING
// ============================================================

class MonitoringController extends FirebaseAdminController {

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        this.ensureInitialized();
        const collections = await this.db.listCollections();
        const stats = { collections: {}, totals: { collections: 0, documents: 0 } };

        for (const collection of collections) {
            const snapshot = await this.db.collection(collection.id).get();
            stats.collections[collection.id] = {
                documentCount: snapshot.size
            };
            stats.totals.collections++;
            stats.totals.documents += snapshot.size;
        }

        return stats;
    }

    /**
     * Get user statistics
     */
    async getUserStats() {
        this.ensureInitialized();
        const result = await this.auth.listUsers(1000);

        const stats = {
            total: result.users.length,
            verified: result.users.filter(u => u.emailVerified).length,
            disabled: result.users.filter(u => u.disabled).length,
            active: result.users.filter(u => !u.disabled).length,
            recentLogins: result.users
                .filter(u => u.metadata.lastSignInTime)
                .sort((a, b) => new Date(b.metadata.lastSignInTime) - new Date(a.metadata.lastSignInTime))
                .slice(0, 10)
                .map(u => ({ uid: u.uid, email: u.email, lastSignIn: u.metadata.lastSignInTime }))
        };

        return stats;
    }

    /**
     * Get recent activity
     */
    async getRecentActivity(limit = 50) {
        this.ensureInitialized();

        // Get recent shipments
        const shipmentsSnap = await this.db.collection('shipments')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        // Get recent invoices
        const invoicesSnap = await this.db.collection('invoices')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const activity = [];

        shipmentsSnap.forEach(doc => {
            const data = doc.data();
            activity.push({
                type: 'shipment',
                id: doc.id,
                tracking: data.tracking_number,
                status: data.status,
                timestamp: data.created_at
            });
        });

        invoicesSnap.forEach(doc => {
            const data = doc.data();
            activity.push({
                type: 'invoice',
                id: doc.id,
                number: data.invoice_number,
                status: data.status,
                total: data.total,
                timestamp: data.created_at
            });
        });

        return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }
}

// ============================================================
// FA-008: BATCH OPERATIONS
// ============================================================

class BatchController extends FirebaseAdminController {

    /**
     * Batch update documents
     */
    async batchUpdate(collectionName, updates) {
        this.ensureInitialized();
        const batch = this.db.batch();
        let count = 0;

        for (const update of updates) {
            const docRef = this.db.collection(collectionName).doc(update.id);
            batch.update(docRef, { ...update.data, updated_at: new Date().toISOString() });
            count++;

            // Firestore batch limit is 500
            if (count >= 500) break;
        }

        await batch.commit();
        return { success: true, updated: count };
    }

    /**
     * Batch delete documents
     */
    async batchDelete(collectionName, documentIds) {
        this.ensureInitialized();
        const batch = this.db.batch();
        let count = 0;

        for (const docId of documentIds) {
            const docRef = this.db.collection(collectionName).doc(docId);
            batch.delete(docRef);
            count++;

            if (count >= 500) break;
        }

        await batch.commit();
        return { success: true, deleted: count };
    }

    /**
     * Batch create documents
     */
    async batchCreate(collectionName, documents) {
        this.ensureInitialized();
        const batch = this.db.batch();
        const ids = [];
        let count = 0;

        for (const doc of documents) {
            const docRef = doc.id
                ? this.db.collection(collectionName).doc(doc.id)
                : this.db.collection(collectionName).doc();

            batch.set(docRef, {
                ...doc.data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            ids.push(docRef.id);
            count++;

            if (count >= 500) break;
        }

        await batch.commit();
        return { success: true, created: count, ids };
    }

    /**
     * Update all users' roles
     */
    async batchUpdateUserRoles(roleUpdates) {
        this.ensureInitialized();
        const results = [];

        for (const update of roleUpdates) {
            try {
                await this.auth.setCustomUserClaims(update.uid, { role: update.role });
                await this.db.collection('users').doc(update.uid).set({
                    role: update.role,
                    updated_at: new Date().toISOString()
                }, { merge: true });
                results.push({ uid: update.uid, success: true });
            } catch (error) {
                results.push({ uid: update.uid, success: false, error: error.message });
            }
        }

        return { results };
    }
}

// ============================================================
// COMBINED CONTROLLER
// ============================================================

class FullFirebaseController {
    constructor(options = {}) {
        this.firestore = new FirestoreController(options);
        this.users = new UserController(options);
        this.security = new SecurityRulesController(options);
        this.config = new ConfigController(options);
        this.backup = new BackupController(options);
        this.monitoring = new MonitoringController(options);
        this.batch = new BatchController(options);
    }

    async initialize(serviceAccountPath = null) {
        // Initialize one, all share the same admin instance
        const result = await this.firestore.initialize(serviceAccountPath);

        // Copy initialization state to all controllers
        this.users.initialized = this.firestore.initialized;
        this.users.db = this.firestore.db;
        this.users.auth = this.firestore.auth;

        this.security.initialized = this.firestore.initialized;
        this.security.db = this.firestore.db;

        this.config.initialized = this.firestore.initialized;
        this.config.db = this.firestore.db;

        this.backup.initialized = this.firestore.initialized;
        this.backup.db = this.firestore.db;

        this.monitoring.initialized = this.firestore.initialized;
        this.monitoring.db = this.firestore.db;
        this.monitoring.auth = this.firestore.auth;

        this.batch.initialized = this.firestore.initialized;
        this.batch.db = this.firestore.db;
        this.batch.auth = this.firestore.auth;

        return result;
    }
}

module.exports = {
    FirebaseAdminController,
    FirestoreController,
    UserController,
    SecurityRulesController,
    ConfigController,
    BackupController,
    MonitoringController,
    BatchController,
    FullFirebaseController
};
