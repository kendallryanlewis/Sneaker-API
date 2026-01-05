/**
 * ============================================================================
 * RESPONSE UTILITY - TABLE OF CONTENTS
 * ============================================================================
 * 
 * 1. Response Functions
 *    1.1 success() - Success response with data
 *    1.2 error() - Error response with message
 *    1.3 notFound() - 404 not found response
 *    1.4 serverError() - 500 server error response
 * 
 * ============================================================================
 */

// ============================================================================
// 1. RESPONSE FUNCTIONS
// ============================================================================

/**
 * 1.1 Success Response
 * 
 * Standardized success response format
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Object} meta - Optional metadata (pagination, counts, etc.)
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const success = (res, data, meta = {}, statusCode = 200) => {
    const response = {
        success: true,
        data: data,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta
        }
    };

    return res.status(statusCode).json(response);
};

/**
 * 1.2 Error Response
 * 
 * Standardized error response format
 * 
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 400)
 * @param {*} details - Optional error details
 */
const error = (res, message, statusCode = 400, details = null) => {
    const response = {
        success: false,
        error: {
            message: message,
            code: statusCode,
            timestamp: new Date().toISOString()
        }
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
};

/**
 * 1.3 Not Found Response
 * 
 * Standardized 404 not found response
 * 
 * @param {Object} res - Express response object
 * @param {String} message - Error message (default: 'Resource not found')
 */
const notFound = (res, message = 'Resource not found') => {
    return error(res, message, 404);
};

/**
 * 1.4 Server Error Response
 * 
 * Standardized 500 server error response
 * 
 * @param {Object} res - Express response object
 * @param {String} message - Error message (default: 'Internal server error')
 * @param {*} details - Optional error details (hidden in production)
 */
const serverError = (res, message = 'Internal server error', details = null) => {
    // Hide details in production
    const errorDetails = process.env.NODE_ENV === 'production' ? null : details;
    return error(res, message, 500, errorDetails);
};

module.exports = {
    success,
    error,
    notFound,
    serverError
};
