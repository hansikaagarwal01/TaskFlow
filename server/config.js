require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'taskflow-dev-access-token-secret-key-32bytes-minimum-security',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  REFRESH_TOKEN_EXPIRES_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  
  AUTH_REFRESH_COOKIE: process.env.AUTH_REFRESH_COOKIE || 'taskflow_refresh',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  cookieConfig: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};
