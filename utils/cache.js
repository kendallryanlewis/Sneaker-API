/**
 * ============================================================================
 * CACHE UTILITY - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Dependencies & Imports
 * 2. Cache Configuration
 * 3. Cache Functions
 *    3.1 get() - Retrieve cached data
 *    3.2 set() - Store data in cache
 *    3.3 del() - Delete cached data
 *    3.4 flush() - Clear all cache
 *    3.5 getStats() - Get cache statistics
 * 
 * ============================================================================
 */

// ============================================================================
// 1. DEPENDENCIES & IMPORTS
// ============================================================================

const NodeCache = require('node-cache');

// ============================================================================
// 2. CACHE CONFIGURATION
// ============================================================================

/**
 * Cache instance with TTL (Time To Live) settings
 * - stdTTL: 1 hour default cache duration
 * - checkperiod: Check for expired keys every 2 minutes
 * - useClones: Clone objects to prevent mutation
 */
const cache = new NodeCache({
    stdTTL: 3600, // 1 hour in seconds
    checkperiod: 120, // Check every 2 minutes
    useClones: false // Better performance, be careful with mutations
});

// ============================================================================
// 3. CACHE FUNCTIONS
// ============================================================================

/**
 * 3.1 Get Cached Data
 * 
 * @param {String} key - Cache key
 * @returns {*} Cached value or undefined if not found/expired
 */
const get = (key) => {
    return cache.get(key);
};

/**
 * 3.2 Set Cache Data
 * 
 * @param {String} key - Cache key
 * @param {*} value - Value to cache
 * @param {Number} ttl - Optional TTL in seconds (overrides default)
 * @returns {Boolean} Success status
 */
const set = (key, value, ttl) => {
    return cache.set(key, value, ttl);
};

/**
 * 3.3 Delete Cache Entry
 * 
 * @param {String} key - Cache key to delete
 * @returns {Number} Number of deleted entries
 */
const del = (key) => {
    return cache.del(key);
};

/**
 * 3.4 Flush All Cache
 * 
 * Clears all cached data
 */
const flush = () => {
    cache.flushAll();
};

/**
 * 3.5 Get Cache Statistics
 * 
 * @returns {Object} Cache stats (hits, misses, keys, etc.)
 */
const getStats = () => {
    return cache.getStats();
};

module.exports = {
    get,
    set,
    del,
    flush,
    getStats,
    cache // Export instance for direct access if needed
};
