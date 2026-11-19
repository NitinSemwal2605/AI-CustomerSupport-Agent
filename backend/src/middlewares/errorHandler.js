/**
 * Global Error Handler Middleware
 */

const env = require('../config/env');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || res.statusCode >= 400 ? res.statusCode : 500;
  
  if (statusCode >= 500) {
    console.error('Unhandled server error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
