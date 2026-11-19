/**
 * JWT Authentication Middleware
 * Validates the Authorization Bearer token on protected endpoints.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired session. Please log in again.'
    });
  }
}

module.exports = authMiddleware;
