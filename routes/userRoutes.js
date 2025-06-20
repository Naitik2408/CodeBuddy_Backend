const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

// Public routes
router.post('/register', rateLimiter.registerLimiter, userController.registerUser);
router.post('/login', rateLimiter.loginLimiter, userController.loginUser);
router.get('/verify/:token', userController.verifyEmail);
router.post('/forgot-password', rateLimiter.passwordResetLimiter, userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected routes (require authentication)
router.use(authMiddleware);

router.get('/profile', userController.getUserProfile);
router.put('/profile', userController.updateUserProfile);
router.post('/change-password', userController.changePassword);
router.delete('/account', userController.deleteUser);
router.get('/:id', userController.getUserById);

module.exports = router;