const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Feedback CRUD operations
router.post('/submit', rateLimiter.feedbackLimiter, feedbackController.submitFeedback);
router.get('/question/:questionId', feedbackController.getQuestionFeedback);
router.get('/my-feedback', feedbackController.getUserFeedback);
router.put('/:id', feedbackController.updateFeedback);
router.delete('/:id', feedbackController.deleteFeedback);

// Feedback interactions
router.post('/:id/vote', rateLimiter.voteLimiter, feedbackController.voteOnFeedback);
router.post('/:id/report', rateLimiter.reportLimiter, feedbackController.reportFeedback);

module.exports = router;