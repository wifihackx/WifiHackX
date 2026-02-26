const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

/**
 * Firestore Data Cleaner
 *
 * Utility for cleaning data before saving to Firestore.
 * Removes undefined values and internal fields that should not be persisted.
 *
 * Following Firestore best practices:
 * - Firestore rejects any field with value `undefined`
 * - Internal fields like `dataId` and `id` should not be saved
 * - Logging uses ASCII prefixes (no emojis)
 *
 * @module firestore-data-cleaner
 */

/**
 * Clean data object for Firestore operations
 *
 * Removes:
 * - Fields with undefined values
 * - Fields with null values
 * - Internal fields (dataId, id)
 *
 * @param {Object} data - Raw data object to clean
 * @param {Object} options - Cleaning options
 * @param {boolean} options.keepNull - Keep null values (default: false)
 * @param {string[]} options.excludeFields - Additional fields to exclude
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Object} Cleaned data object safe for Firestore
 */
function cleanDataForFirestore(data, options = {}) {
  const { keepNull = false, excludeFields = [], verbose = false } = options;

  if (!data || typeof data !== 'object') {
    console.warn('[FIRESTORE-CLEANER] Invalid data provided:', typeof data);
    return {};
  }

  // Log original data if verbose
  if (verbose) {
    debugLog('[FIRESTORE-CLEANER] Original data:', data);
  }

  const cleaned = {};
  const internalFields = ['dataId', 'id', ...excludeFields];
  const skippedFields = [];

  for (const [key, value] of Object.entries(data)) {
    // Skip undefined values
    if (value === undefined) {
      skippedFields.push(`${key} (undefined)`);
      continue;
    }

    // Skip null values unless keepNull is true
    if (value === null && !keepNull) {
      skippedFields.push(`${key} (null)`);
      continue;
    }

    // Skip internal fields
    if (internalFields.includes(key)) {
      skippedFields.push(`${key} (internal field)`);
      continue;
    }

    // Keep valid field
    cleaned[key] = value;
  }

  // Log cleaning results
  if (skippedFields.length > 0) {
    debugLog('[FIRESTORE-CLEANER] Skipped fields:', skippedFields.join(', '));
  }

  if (verbose) {
    debugLog('[FIRESTORE-CLEANER] Cleaned data:', cleaned);
  }

  return cleaned;
}

/**
 * Validate data before Firestore operation
 *
 * Checks for:
 * - Undefined values
 * - Invalid types (functions, symbols)
 * - Required fields
 *
 * @param {Object} data - Data to validate
 * @param {Object} options - Validation options
 * @param {string[]} options.requiredFields - Fields that must be present
 * @param {Object} options.typeChecks - Type validation rules
 * @returns {Object} Validation result with valid flag and errors array
 */
function validateDataForFirestore(data, options = {}) {
  const { requiredFields = [], typeChecks = {} } = options;

  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { valid: false, errors };
  }

  // Check for undefined values
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      errors.push(`Field "${key}" has undefined value`);
    }

    // Check for invalid types
    if (typeof value === 'function') {
      errors.push(`Field "${key}" has invalid type: function`);
    }

    if (typeof value === 'symbol') {
      errors.push(`Field "${key}" has invalid type: symbol`);
    }
  }

  // Check required fields
  for (const field of requiredFields) {
    if (
      !(field in data) ||
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ''
    ) {
      errors.push(`Required field "${field}" is missing or empty`);
    }
  }

  // Check type validations
  for (const [field, expectedType] of Object.entries(typeChecks)) {
    if (field in data && data[field] !== undefined && data[field] !== null) {
      const actualType = typeof data[field];

      if (expectedType === 'array') {
        if (!Array.isArray(data[field])) {
          errors.push(`Field "${field}" must be an array, got ${actualType}`);
        }
      } else if (actualType !== expectedType) {
        errors.push(`Field "${field}" must be ${expectedType}, got ${actualType}`);
      }
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    console.warn('[FIRESTORE-CLEANER] Validation failed:', errors);
  }

  return { valid, errors };
}

/**
 * Clean and validate data in one operation
 *
 * @param {Object} data - Raw data to clean and validate
 * @param {Object} options - Combined options for cleaning and validation
 * @returns {Object} Result with cleaned data and validation status
 */
function cleanAndValidate(data, options = {}) {
  // Clean data first
  const cleaned = cleanDataForFirestore(data, options);

  // Then validate
  const validation = validateDataForFirestore(cleaned, options);

  return {
    data: cleaned,
    valid: validation.valid,
    errors: validation.errors,
  };
}

/**
 * Deep clean nested objects
 *
 * Recursively cleans nested objects and arrays
 *
 * @param {*} data - Data to clean (can be object, array, or primitive)
 * @param {Object} options - Cleaning options
 * @returns {*} Cleaned data
 */
function deepCleanForFirestore(data, options = {}) {
  // Handle null and undefined
  if (data === undefined) {
    return undefined;
  }

  if (data === null) {
    return options.keepNull ? null : undefined;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data
      .map(item => deepCleanForFirestore(item, options))
      .filter(item => item !== undefined);
  }

  // Handle objects
  if (typeof data === 'object') {
    const cleaned = {};
    const internalFields = ['dataId', 'id', ...(options.excludeFields || [])];

    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (internalFields.includes(key)) {
        continue;
      }

      const cleanedValue = deepCleanForFirestore(value, options);

      // Only add if not undefined
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }

    return cleaned;
  }

  // Return primitives as-is
  return data;
}

export function initFirestoreCleaner() {
  if (window.__FIRESTORE_CLEANER_INITED__) {
    return;
  }
  window.__FIRESTORE_CLEANER_INITED__ = true;

  if (typeof window === 'undefined') return;

  window.cleanDataForFirestore = cleanDataForFirestore;
  window.validateDataForFirestore = validateDataForFirestore;
  window.cleanAndValidate = cleanAndValidate;
  window.deepCleanForFirestore = deepCleanForFirestore;

  // Debug API
  window.firestoreCleanerDebug = {
    test: (data, options) => {
      debugLog('[FIRESTORE-CLEANER] Testing with data:', data);
      const result = cleanAndValidate(data, options);
      debugLog('[FIRESTORE-CLEANER] Result:', result);
      return result;
    },
    version: '1.0.0',
  };

  debugLog('[FIRESTORE-CLEANER] Initialized successfully');
}

// Export for ES modules and tests
if (typeof window !== 'undefined' && !window.__FIRESTORE_CLEANER_NO_AUTO__) {
  initFirestoreCleaner();
}
