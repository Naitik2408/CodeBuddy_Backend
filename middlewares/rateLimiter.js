const rateLimit = require('express-rate-limit');

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    message: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Registration rate limiter
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    message: 'Too many registration attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    message: 'Too many password reset attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Group creation rate limiter
const groupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 group creations per hour
  message: {
    message: 'Too many groups created, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Group join rate limiter
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 join attempts per 15 minutes
  message: {
    message: 'Too many join attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Invite code generation rate limiter
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 invite code generations per hour
  message: {
    message: 'Too many invite code generations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Question creation rate limiter
const questionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 question creations per hour
  message: {
    message: 'Too many questions posted, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Solution submission rate limiter
const solutionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 solution submissions per 15 minutes
  message: {
    message: 'Too many solutions submitted, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Comment rate limiter
const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 comments per 5 minutes
  message: {
    message: 'Too many comments posted, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Feedback submission rate limiter
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 feedback submissions per hour
  message: {
    message: 'Too many feedback submissions, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vote rate limiter (for likes, ratings, etc.)
const voteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 votes per 5 minutes
  message: {
    message: 'Too many votes, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Report rate limiter
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 reports per hour
  message: {
    message: 'Too many reports submitted, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search rate limiter
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: {
    message: 'Too many search requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    message: 'Too many file uploads, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Profile update rate limiter
const profileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 profile updates per hour
  message: {
    message: 'Too many profile updates, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification rate limiter
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 email verification requests per hour
  message: {
    message: 'Too many email verification requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact/Support rate limiter
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 contact requests per hour
  message: {
    message: 'Too many contact requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter (most permissive)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Very strict limit
  message: {
    message: 'Rate limit exceeded for sensitive operation, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Development rate limiter (more permissive)
const devLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very high limit for development
  message: {
    message: 'Development rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export all rate limiters
module.exports = {
  // Authentication related
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  
  // Group related
  groupLimiter,
  joinLimiter,
  inviteLimiter,
  
  // Question related
  questionLimiter,
  solutionLimiter,
  commentLimiter,
  
  // Interaction related
  voteLimiter,
  feedbackLimiter,
  reportLimiter,
  searchLimiter,
  
  // User related
  profileLimiter,
  uploadLimiter,
  contactLimiter,
  
  // General limiters
  apiLimiter,
  strictLimiter,
  devLimiter,
  
  // Aliases for backward compatibility
  authLimiter: loginLimiter,
};