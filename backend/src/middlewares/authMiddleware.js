/**
 * JWT Authentication Middleware
 * Validates the Authorization Bearer token on protected endpoints
 * and confirms the user exists in PostgreSQL.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');

async function authMiddleware(req, res, next) {
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
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token. Please log in again.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Session user no longer exists in database. Please log in again.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired session. Please log in again.'
    });
  }
}

module.exports = authMiddleware;
