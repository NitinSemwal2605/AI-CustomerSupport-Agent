/**
 * JWT Authentication Module with Prisma + PostgreSQL
 * Handles User Registration, Login, Password Hashing (bcrypt),
 * and JWT Token Verification using PostgreSQL database via Prisma ORM.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'gemini_secret_jwt_key_2026_super_secure';

/**
 * Pre-seed demo user if database is empty
 */
async function initSeedUser() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const demoSalt = await bcrypt.genSalt(10);
      const demoPasswordHash = await bcrypt.hash('password123', demoSalt);
      await prisma.user.create({
        data: {
          name: 'Nitin',
          email: 'nitin@gmail.com',
          passwordHash: demoPasswordHash
        }
      });
      console.log('✅ Demo account seeded into PostgreSQL (nitin@gmail.com / password123)');
    }
  } catch (err) {
    console.warn('⚠️ Notice during user seed check:', err.message);
  }
}

// Run initial check asynchronously
initSeedUser();

/**
 * Register a new user in PostgreSQL
 */
async function registerUser({ name, email, password }) {
  if (!email || !password) {
    throw new Error('Email/Gmail and password are required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || cleanEmail.split('@')[0]).trim();

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const existing = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

  if (existing) {
    throw new Error('An account with this email/Gmail username already exists.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      passwordHash
    }
  });

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
    token
  };
}

/**
 * Login user with email & password via PostgreSQL
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Please enter both email/Gmail and password.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

  if (!user) {
    throw new Error('Invalid email or password. Please try again.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email or password. Please try again.');
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: { id: user.id, name: user.name, email: user.email },
    token
  };
}

/**
 * Express middleware to verify JWT token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = {
  registerUser,
  loginUser,
  authMiddleware
};
