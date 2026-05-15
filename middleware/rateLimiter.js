const rateLimit = require('express-rate-limit');

// Strict limiter for login (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// General API limiter (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
});

// Stricter limiter for review/inquiry submission (10 per minute)
const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please wait a moment.' },
});

module.exports = { loginLimiter, apiLimiter, submissionLimiter };