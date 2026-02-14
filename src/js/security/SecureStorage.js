/**
 * SecureStorage - Official Module
 * Provides secure storage with encryption using Web Crypto API
 *
 * Replaces: bundle-app-fixes.js SecureStorage patch
 * @version 2.0.0
 * @author WifiHackX Team
 */

/* global crypto, TextEncoder, TextDecoder */

'use strict';

function setupSecureStorage() {

  /**
   * SecureStorage Class
   * Handles encrypted storage using Web Crypto API (AES-GCM)
   */
  class SecureStorage {
    constructor() {
      this.keyPrefix = 'wifiHackX_';
      this.encryptionKey = null;
      this.initPromise = this.initialize();
    }

    /**
     * Initialize encryption key from password
     * @private
     */
    async initialize() {
      try {
        // Derive key from static password (in production, use user-specific key)
        const password = 'WFX-SEC-2026-CRYPTO';
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          passwordBuffer,
          'PBKDF2',
          false,
          ['deriveKey']
        );

        // Derive AES-GCM key
        this.encryptionKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode('wifihackx-salt-2026'),
            iterations: 100000,
            hash: 'SHA-256',
          },
          keyMaterial,
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt']
        );

        console.log('✅ [SecureStorage] Encryption key initialized');
      } catch (error) {
        console.error(
          '❌ [SecureStorage] Failed to initialize encryption:',
          error
        );
        // Fallback to XOR if Web Crypto fails
        this.encryptionKey = null;
      }
    }

    /**
     * Encrypt data using AES-GCM
     * @private
     */
    async _encrypt(data) {
      await this.initPromise;

      if (!this.encryptionKey) {
        // Fallback to XOR for compatibility
        return this._xorEncrypt(data);
      }

      try {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encryptedBuffer = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv,
          },
          this.encryptionKey,
          dataBuffer
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        // Convert to base64
        return btoa(String.fromCharCode(...combined));
      } catch (error) {
        console.error('❌ [SecureStorage] Encryption failed:', error);
        return this._xorEncrypt(data);
      }
    }

    /**
     * Decrypt data using AES-GCM
     * @private
     */
    async _decrypt(encryptedData) {
      await this.initPromise;

      if (!this.encryptionKey) {
        // Fallback to XOR for compatibility
        return this._xorDecrypt(encryptedData);
      }

      try {
        // Decode from base64
        const combined = Uint8Array.from(atob(encryptedData), c =>
          c.charCodeAt(0)
        );

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encryptedBuffer = combined.slice(12);

        // Decrypt
        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv,
          },
          this.encryptionKey,
          encryptedBuffer
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
      } catch (error) {
        // Try XOR fallback for legacy data
        try {
          return this._xorDecrypt(encryptedData);
        } catch (_xorError) {
          // XOR decryption failed, return null
          console.error('❌ [SecureStorage] Decryption failed:', error);
          return null;
        }
      }
    }

    /**
     * XOR encryption (fallback for compatibility)
     * @private
     */
    _xorEncrypt(str) {
      if (!str) return '';
      const key = 'WFX-SEC-2026';
      let result = '';
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(
          str.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return btoa(result);
    }

    /**
     * XOR decryption (fallback for compatibility)
     * @private
     */
    _xorDecrypt(b64) {
      if (!b64) return '';
      try {
        const str = atob(b64);
        const key = 'WFX-SEC-2026';
        let result = '';
        for (let i = 0; i < str.length; i++) {
          result += String.fromCharCode(
            str.charCodeAt(i) ^ key.charCodeAt(i % key.length)
          );
        }
        return result;
      } catch (_e) {
        return '';
      }
    }

    /**
     * Get item from secure storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Stored value or null
     */
    async getSecureItem(key) {
      try {
        const secureKey = key.startsWith(this.keyPrefix)
          ? key
          : `${this.keyPrefix}${key}`;
        let value = localStorage.getItem(secureKey);

        // Migration: Check for legacy key
        if (!value && key !== secureKey) {
          const legacyValue = localStorage.getItem(key);
          if (legacyValue) {
            console.log(`📦 [SecureStorage] Migrating legacy data: ${key}`);
            await this.setSecureItem(key, JSON.parse(legacyValue));
            localStorage.removeItem(key);
            value = localStorage.getItem(secureKey);
          }
        }

        if (!value) return null;

        // Decrypt
        const decrypted = await this._decrypt(value);
        if (!decrypted) return null;

        // Parse JSON
        try {
          return JSON.parse(decrypted);
        } catch (_e) {
          return decrypted;
        }
      } catch (error) {
        console.error('❌ [SecureStorage] Error getting item:', error);
        return null;
      }
    }

    /**
     * Set item in secure storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    async setSecureItem(key, value) {
      try {
        const secureKey = key.startsWith(this.keyPrefix)
          ? key
          : `${this.keyPrefix}${key}`;
        const json = JSON.stringify(value);
        const encrypted = await this._encrypt(json);
        localStorage.setItem(secureKey, encrypted);

        // Remove legacy key if exists
        if (key !== secureKey) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error('❌ [SecureStorage] Error setting item:', error);
      }
    }

    /**
     * Remove item from secure storage
     * @param {string} key - Storage key
     */
    removeSecureItem(key) {
      try {
        const secureKey = key.startsWith(this.keyPrefix)
          ? key
          : `${this.keyPrefix}${key}`;
        localStorage.removeItem(secureKey);
        localStorage.removeItem(key); // Also remove legacy key
      } catch (error) {
        console.error('❌ [SecureStorage] Error removing item:', error);
      }
    }

    /**
     * Synchronous get (uses cached value or returns null)
     * For compatibility with code expecting sync API
     * @deprecated Use getSecureItem() instead
     */
    getSecureItemSync(key) {
      console.warn(
        '[SecureStorage] getSecureItemSync is deprecated, use async getSecureItem()'
      );
      try {
        const secureKey = key.startsWith(this.keyPrefix)
          ? key
          : `${this.keyPrefix}${key}`;
        const value = localStorage.getItem(secureKey);
        if (!value) return null;

        // Try XOR decrypt (sync fallback)
        const decrypted = this._xorDecrypt(value);
        if (!decrypted) return null;

        try {
          return JSON.parse(decrypted);
        } catch (_e) {
          return decrypted;
        }
      } catch (error) {
        console.error('❌ [SecureStorage] Error in sync get:', error);
        return null;
      }
    }
  }

  // Create singleton instance
  const secureStorageInstance = new SecureStorage();

  // Expose globally
  window.SecureStorage = {
    getSecureItem: key => secureStorageInstance.getSecureItem(key),
    setSecureItem: (key, value) =>
      secureStorageInstance.setSecureItem(key, value),
    removeSecureItem: key => secureStorageInstance.removeSecureItem(key),

    // Legacy sync API (deprecated)
    getSecureItemSync: key => secureStorageInstance.getSecureItemSync(key),

    // Internal methods (exposed for migration scripts)
    _instance: secureStorageInstance,
    _obfuscate: str => secureStorageInstance._xorEncrypt(str),
    _deobfuscate: b64 => secureStorageInstance._xorDecrypt(b64),
  };

  console.log('✅ [SecureStorage] Official module loaded (Web Crypto API)');
}

export function initSecureStorage() {
  if (window.__SECURE_STORAGE_INITED__) {
    return;
  }

  window.__SECURE_STORAGE_INITED__ = true;
  setupSecureStorage();
}

if (typeof window !== 'undefined' && !window.__SECURE_STORAGE_NO_AUTO__) {
  initSecureStorage();
}
