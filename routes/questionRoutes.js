const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Question CRUD operations
router.post('/create', rateLimiter.apiLimiter, questionController.createQuestion);
router.get('/group/:groupId', questionController.getQuestionsByGroup);
router.get('/search', questionController.searchQuestions);
router.get('/:id', questionController.getQuestionById);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);

// Question interactions
router.post('/:id/rate', questionController.rateDifficulty);
router.post('/:id/like', questionController.toggleLike);
router.post('/:id/solutions', questionController.addSolution);
router.get('/:id/solutions', questionController.getSolutions);

// Member response routes (NEW)
router.post('/:questionId/response', rateLimiter.apiLimiter, questionController.submitMemberResponse);
router.get('/:questionId/response', questionController.getUserQuestionResponse);
router.get('/:questionId/responses', questionController.getQuestionMemberResponses);

module.exports = router;