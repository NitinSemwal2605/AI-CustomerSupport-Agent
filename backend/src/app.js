/**
 * Express Application Setup
 * Configures middleware stack, routes, and error handling.
 */

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');

const app = express();

// CORS configuration (allows requests from frontend dev servers)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Mount all API routes under /api
app.use('/api', apiRoutes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
