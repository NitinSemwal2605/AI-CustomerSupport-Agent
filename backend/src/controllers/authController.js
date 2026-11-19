/**
 * Authentication Controller
 * Handles HTTP requests for registration, login, and user profile.
 */

const { registerUser, loginUser } = require('../services/authService');

async function handleRegister(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const result = await registerUser({ name, email, password });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function handleLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetMe(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = {
  handleRegister,
  handleLogin,
  handleGetMe
};
