/**
 * Authentication Routes (/api/auth)
 */

const express = require('express');
const { handleRegister, handleLogin, handleGetMe } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.get('/me', authMiddleware, handleGetMe);

module.exports = router;
