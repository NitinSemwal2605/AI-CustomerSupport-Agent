/**
 * Application Configuration & Environment Variables
 */

require('dotenv').config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'gemini_secret_jwt_key_2026_super_secure',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nitin@localhost:5432/closedai_db?schema=public'
};

module.exports = env;
