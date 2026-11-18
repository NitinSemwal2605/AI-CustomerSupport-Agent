/**
 * JWT Authentication Module
 * Handles User Registration, Login, Password Hashing (bcrypt),
 * and JWT Token Verification.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'gemini_secret_jwt_key_2026_super_secure';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize users file if missing
if (!fs.existsSync(USERS_FILE)) {
  // Pre-seed with a demo account for quick testing
  const demoSalt = bcrypt.genSaltSync(10);
  const demoPasswordHash = bcrypt.hashSync('password123', demoSalt);
  const initialUsers = [
    {
      id: 'demo-user-1',
      name: 'Nitin',
      email: 'nitin@gmail.com',
      passwordHash: demoPasswordHash,
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
}

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users file:', err);
  }
}

/**
 * Register a new user
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

  const users = readUsers();
  const existing = users.find((u) => u.email === cleanEmail);
  if (existing) {
    throw new Error('An account with this email/Gmail username already exists.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);

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
 * Login user with email & password
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Please enter both email/Gmail and password.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = readUsers();
  const user = users.find((u) => u.email === cleanEmail);

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
