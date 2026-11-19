/**
 * Authentication Service
 * Handles user management, password hashing, JWT generation,
 * and database interactions with PostgreSQL via Prisma.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const env = require('../config/env');

/**
 * Seed default demo account if table is empty
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

// Seed on module load
initSeedUser();

/**
 * Register a new user
 */
async function registerUser({ name, email, password }) {
  if (!email || !password) {
    const error = new Error('Email/Gmail and password are required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || cleanEmail.split('@')[0]).trim();

  if (password.length < 6) {
    const error = new Error('Password must be at least 6 characters.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

  if (existing) {
    const error = new Error('An account with this email/Gmail username already exists.');
    error.statusCode = 400;
    throw error;
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

  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
    token
  };
}

/**
 * Authenticate existing user with email and password
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    const error = new Error('Please enter both email/Gmail and password.');
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

  if (!user) {
    const error = new Error('Invalid email or password. Please try again.');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password. Please try again.');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: { id: user.id, name: user.name, email: user.email },
    token
  };
}

module.exports = {
  registerUser,
  loginUser,
  initSeedUser
};
