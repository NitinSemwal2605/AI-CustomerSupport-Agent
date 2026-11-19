/**
 * Master API Router (/api)
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');

const router = express.Router();

// Mount auth endpoints under /api/auth
router.use('/auth', authRoutes);

// Mount chat & core endpoints under /api
router.use('/', chatRoutes);

module.exports = router;
