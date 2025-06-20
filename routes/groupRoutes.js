const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Group CRUD operations
router.post('/create', rateLimiter.groupLimiter, groupController.createGroup);
router.post('/join', rateLimiter.joinLimiter, groupController.joinGroup);
router.get('/my-groups', groupController.getUserGroups);
router.get('/:id', groupController.getGroupDetails);
router.put('/:id', groupController.updateGroup);

// Group member operations - ADD THESE MISSING ROUTES
router.get('/:id/members', groupController.getGroupMembers);
router.get('/:id/questions', groupController.getGroupQuestions);

// Group management
router.post('/:id/leave', groupController.leaveGroup);
router.delete('/:id/members/:memberId', groupController.removeMember);
router.post('/:id/invite-code', rateLimiter.inviteLimiter, groupController.generateInviteCode);

module.exports = router;