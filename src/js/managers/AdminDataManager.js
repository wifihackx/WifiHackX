/**
 * AdminDataManager - Official Module
 * Centralized data management for admin panel operations
 *
 * Replaces: fix-renderer.js AdminDataManager shim
 * @version 2.0.0
 * @author WifiHackX Team
 */

'use strict';

  /**
   * AdminDataManager Class
   * Handles all Firestore operations for admin panel
   */
  class AdminDataManager {
    constructor() {
      this._db = null;
      this._subscriptions = []; // Array to store active listeners
    }

    /**
     * Get Firestore instance (lazy initialization)
     * @returns {firebase.firestore.Firestore|null}
     */
    get db() {
      if (!this._db) {
        if (window.db) {
          this._db = window.db;
        } else if (
          window.firebase &&
          window.firebase.apps &&
          window.firebase.apps.length > 0
        ) {
          this._db = window.firebase.firestore();
        } else if (window.firebaseModular && window.firebaseModular.db) {
          this._db = window.firebaseModular.db;
        } else {
          console.warn('[AdminDataManager] Firebase not initialized yet');
          return null;
        }
      }
      return this._db;
    }

    /**
     * Subscribe to a Firestore collection in real-time
     * @param {string} collectionName - Collection name
     * @param {Function} callback - Callback function with data array
     * @returns {Function} Unsubscribe function
     */
    subscribeToCollection(collectionName, callback) {
      if (!this.db) return () => {};

      // ✅ AUTHENTICATION GUARD: Only subscribe if user is authenticated
      const user =
        window.firebase &&
        window.firebase.auth &&
        window.firebase.auth().currentUser;
      if (!user) {
        console.log(
          `[AdminDataManager] No authenticated user, skipping subscription to ${collectionName}`
        );
        return () => {};
      }

      try {
        console.log(`[AdminDataManager] 📡 Subscribing to: ${collectionName}`);

        const unsubscribe = this.db
          .collection(collectionName)
          .orderBy('createdAt', 'desc')
          .onSnapshot(
            snapshot => {
              const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              }));
              callback(data);
            },
            error => {
              console.error(
                `[AdminDataManager] ❌ Error in ${collectionName} listener:`,
                error
              );
              if (error.code === 'permission-denied') {
                console.warn(
                  `[AdminDataManager] Permission denied for ${collectionName}. User may not have required permissions.`
                );
              }
            }
          );

        this._subscriptions.push(unsubscribe);
        return unsubscribe;
      } catch (e) {
        console.error(
          `[AdminDataManager] Error setting up listener for ${collectionName}:`,
          e
        );
        return () => {};
      }
    }

    /**
     * Subscribe to a specific Firestore document
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @param {Function} callback - Callback function with document data
     * @returns {Function} Unsubscribe function
     */
    subscribeToDocument(collectionName, docId, callback) {
      if (!this.db) return () => {};

      // ✅ AUTHENTICATION GUARD
      const user =
        window.firebase &&
        window.firebase.auth &&
        window.firebase.auth().currentUser;
      if (!user) {
        console.log(
          `[AdminDataManager] No authenticated user, skipping document subscription to ${collectionName}/${docId}`
        );
        return () => {};
      }

      try {
        const unsubscribe = this.db
          .collection(collectionName)
          .doc(docId)
          .onSnapshot(
            doc => {
              if (doc.exists) {
                callback({
                  id: doc.id,
                  ...doc.data(),
                });
              } else {
                callback(null);
              }
            },
            error => {
              console.error(
                `[AdminDataManager] Error watching doc ${collectionName}/${docId}`,
                error
              );
              if (error.code === 'permission-denied') {
                console.warn(
                  `[AdminDataManager] Permission denied for ${collectionName}/${docId}`
                );
              }
            }
          );

        this._subscriptions.push(unsubscribe);
        return unsubscribe;
      } catch (e) {
        console.error('[AdminDataManager] Error in subscribeToDocument:', e);
        return () => {};
      }
    }

    /**
     * Unsubscribe from all active listeners
     */
    unsubscribeAll() {
      if (this._subscriptions.length > 0) {
        console.log(
          `[AdminDataManager] 🧹 Cleaning ${this._subscriptions.length} subscriptions...`
        );
        this._subscriptions.forEach(unsub => unsub && unsub());
        this._subscriptions = [];
      }
    }

    /**
     * Validate document ID (prevent injection attacks)
     * @private
     * @param {string} id - Document ID
     * @returns {boolean}
     */
    _validateId(id) {
      if (typeof id !== 'string') return false;
      return /^[a-zA-Z0-9_-]+$/.test(id);
    }

    /**
     * Espera a que el usuario esté autenticado (evita errores tras borrar cookies)
     * @private
     * @param {number} timeoutMs
     * @returns {Promise<Object>} user
     */
    _waitForAuthReady(timeoutMs = 8000) {
      return new Promise(resolve => {
        if (!window.firebase || !window.firebase.auth) {
          resolve(null);
          return;
        }
        const auth = window.firebase.auth();
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }
        const timeout = setTimeout(() => {
          if (unsubscribe) unsubscribe();
          resolve(null);
        }, timeoutMs);
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user) {
            clearTimeout(timeout);
            if (unsubscribe) unsubscribe();
            resolve(user);
          }
        });
      });
    }

    // ==================== ANNOUNCEMENT METHODS ====================

    /**
     * Get all announcements
     * @returns {Promise<Array>}
     */
    async getAllAnnouncements() {
      try {
        const snapshot = await this.db
          .collection('announcements')
          .orderBy('createdAt', 'desc')
          .get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error('[AdminDataManager] Error fetching announcements:', e);
        return [];
      }
    }

    /**
     * Get announcement by ID
     * @param {string} id - Announcement ID
     * @returns {Promise<Object|null>}
     */
    async getAnnouncementById(id) {
      try {
        if (!this._validateId(id)) {
          throw new Error('Invalid or malformed announcement ID');
        }
        const doc = await this.db.collection('announcements').doc(id).get();
        if (!doc.exists) return null;
        return {
          id: doc.id,
          ...doc.data(),
        };
      } catch (e) {
        console.error('[AdminDataManager] Error fetching announcement:', e);
        return null;
      }
    }

    /**
     * Create new announcement
     * @param {Object} data - Announcement data
     * @returns {Promise<Object>}
     */
    async createAnnouncement(data) {
      try {
        const cleanData = {
          ...data,
          description: data.description || '',
          name:
            window.XSSProtection && window.XSSProtection.sanitizeSafe
              ? window.XSSProtection.sanitizeSafe(data.name)
              : (data.name || '').replace(/<[^>]*>?/gm, ''),
          active: data.active !== undefined ? data.active : true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await this.db.collection('announcements').add(cleanData);
        return {
          success: true,
          id: docRef.id,
        };
      } catch (e) {
        console.error('[AdminDataManager] Error creating announcement:', e);
        return {
          success: false,
          error: e.message,
        };
      }
    }

    /**
     * Update announcement
     * @param {string} id - Announcement ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>}
     */
    async updateAnnouncement(id, data) {
      try {
        if (!this._validateId(id)) {
          throw new Error('Invalid or malformed announcement ID');
        }
        const cleanData = {
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        if (cleanData.description)
          cleanData.description = data.description || '';
        if (cleanData.name)
          cleanData.name =
            window.XSSProtection && window.XSSProtection.sanitizeSafe
              ? window.XSSProtection.sanitizeSafe(cleanData.name)
              : cleanData.name.replace(/<[^>]*>?/gm, '');

        await this.db.collection('announcements').doc(id).update(cleanData);
        return {
          success: true,
        };
      } catch (e) {
        console.error('[AdminDataManager] Error updating announcement:', e);
        return {
          success: false,
          error: e.message,
        };
      }
    }

    // ==================== FILE UPLOAD METHODS ====================

    /**
     * Upload image to Firebase Storage
     * @param {File} file - Image file
     * @returns {Promise<Object>}
     */
    async uploadImage(file) {
      return this.uploadFile(file, 'images');
    }

    /**
     * Upload video to Firebase Storage
     * @param {File} file - Video file
     * @returns {Promise<Object>}
     */
    async uploadVideo(file) {
      return this.uploadFile(file, 'videos');
    }

    /**
     * Upload file to Firebase Storage
     * @param {File} file - File to upload
     * @param {string} folder - Storage folder
     * @returns {Promise<Object>}
     */
    async uploadFile(file, folder) {
      if (!window.firebase || !window.firebase.storage) {
        throw new Error('Firebase Storage not initialized');
      }
      try {
        const storageRef = window.firebase.storage().ref();
        const fileRef = storageRef.child(
          `announcements/${folder}/${Date.now()}_${file.name}`
        );
        const snapshot = await fileRef.put(file);
        const url = await snapshot.ref.getDownloadURL();
        return {
          success: true,
          url: url,
        };
      } catch (e) {
        console.error('[AdminDataManager] Error uploading file:', e);
        throw e;
      }
    }

    // ==================== DASHBOARD DATA METHODS ====================

    /**
     * Get all users
     * @returns {Promise<Array>}
     */
    async getUsers() {
      try {
        const user = await this._waitForAuthReady();
        if (!user) return [];
        const snapshot = await this.db.collection('users').get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error('[AdminDataManager] Error fetching users:', e);
        return [];
      }
    }

    /**
     * Get all orders
     * @returns {Promise<Array>}
     */
    async getOrders() {
      try {
        const user = await this._waitForAuthReady();
        if (!user) return [];
        const snapshot = await this.db.collection('orders').get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error('[AdminDataManager] Error fetching orders:', e);
        return [];
      }
    }

    /**
     * Get analytics visits
     * @returns {Promise<Array>}
     */
    async getVisits() {
      try {
        const user = await this._waitForAuthReady();
        if (!user) return [];
        const snapshot = await this.db.collection('analytics_visits').get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error('[AdminDataManager] Error fetching visits:', e);
        return [];
      }
    }

    /**
     * Get all dashboard data (users, orders, products, announcements, visits)
     * @returns {Promise<Object>}
     */
    async getAllData() {
      try {
        console.log('[AdminDataManager] Fetching all data for dashboard...');
        const user = await this._waitForAuthReady();
        if (!user) {
          return {
            users: [],
            orders: [],
            products: [],
            announcements: [],
            visits: [],
          };
        }
        const collections = [
          'users',
          'orders',
          'products',
          'announcements',
          'analytics_visits',
        ];

        const results = await Promise.allSettled(
          collections.map(col => this.db.collection(col).get())
        );

        const data = {
          users: [],
          orders: [],
          products: [],
          announcements: [],
          visits: [],
        };

        const mapKey = col => (col === 'analytics_visits' ? 'visits' : col);

        results.forEach((res, index) => {
          const colName = collections[index];
          const key = mapKey(colName);

          if (res.status === 'fulfilled') {
            data[key] = res.value.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
          } else {
            console.warn(
              `[AdminDataManager] Failed to fetch ${colName}:`,
              res.reason
            );
          }
        });

        return data;
      } catch (e) {
        console.error('[AdminDataManager] Error in getAllData:', e);
        return {
          users: [],
          orders: [],
          products: [],
          announcements: [],
          visits: [],
        };
      }
    }

    // ==================== ACTIVITY LOGGING ====================

    /**
     * Add activity log
     * @param {Object} activity - Activity data
     */
    async addActivity(activity) {
      try {
        const activities = await this.getActivities();
        activities.unshift({
          ...activity,
          timestamp: new Date().toISOString(),
          id: Date.now(),
        });

        const limitedActivities = activities.slice(0, 100);
        await window.SecureStorage.setSecureItem(
          'wifiHackXActivities',
          limitedActivities
        );
        console.log('✅ [AdminDataManager] Activity logged:', activity.type);
      } catch (error) {
        console.error('❌ [AdminDataManager] Error logging activity:', error);
      }
    }

    /**
     * Get activity logs
     * @returns {Promise<Array>}
     */
    async getActivities() {
      try {
        return (
          (await window.SecureStorage.getSecureItem('wifiHackXActivities')) ||
          []
        );
      } catch (error) {
        console.error('❌ [AdminDataManager] Error getting activities:', error);
        return [];
      }
    }
  }

function setupAdminDataManager() {
  // Create singleton instance
  const instance = new AdminDataManager();

  // Expose class for instantiation
  window.AdminDataManagerClass = AdminDataManager;

  // Expose singleton instance with static methods (for backward compatibility)
  const methods = [
    'subscribeToCollection',
    'subscribeToDocument',
    'unsubscribeAll',
    'getAllAnnouncements',
    'getAnnouncementById',
    'createAnnouncement',
    'updateAnnouncement',
    'uploadImage',
    'uploadVideo',
    'uploadFile',
    'getUsers',
    'getOrders',
    'getVisits',
    'getAllData',
    'addActivity',
    'getActivities',
  ];

  // Create static methods that delegate to singleton
  methods.forEach(method => {
    if (typeof instance[method] === 'function') {
      AdminDataManager[method] = instance[method].bind(instance);
    }
  });

  // Expose globally (dual mode: class + singleton)
  window.AdminDataManager = AdminDataManager;
  window.adminDataManager = instance; // lowercase for explicit singleton access

  console.log('✅ [AdminDataManager] Official module loaded');
}

export function initAdminDataManager() {
  if (window.__ADMIN_DATA_MANAGER_INITED__) {
    return;
  }

  window.__ADMIN_DATA_MANAGER_INITED__ = true;
  setupAdminDataManager();
}
