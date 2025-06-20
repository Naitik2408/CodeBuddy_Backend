const Question = require('../models/Question');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const mongoose = require('mongoose');

// Create a new question (alias for addQuestion)
const createQuestion = async (req, res) => {
  try {
    const { title, description, sourceUrl, difficulty, category, tags, platform, groupId } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!title || !sourceUrl || !difficulty || !category || !groupId) {
      return res.status(400).json({
        message: 'Title, source URL, difficulty, category, and group ID are required'
      });
    }

    // Check if group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({
      userId,
      groupId,
      status: 'active'
    });

    if (!membership) {
      return res.status(403).json({ message: 'You must be a member of this group to add questions' });
    }

    // Check for duplicate questions in the same group
    const existingQuestion = await Question.findOne({
      sourceUrl,
      groupId,
      status: 'active'
    });

    if (existingQuestion) {
      return res.status(400).json({ message: 'This question already exists in the group' });
    }

    // Create the question
    const question = new Question({
      title: title.trim(),
      description: description?.trim(),
      sourceUrl: sourceUrl.trim(),
      difficulty,
      category: category.trim(),
      tags: tags || [],
      platform,
      groupId,
      postedBy: userId
    });

    await question.save();

    // Populate the question with user info
    await question.populate('postedBy', 'name email avatar');

    res.status(201).json({
      message: 'Question created successfully',
      question
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      message: 'Failed to create question',
      error: error.message
    });
  }
};

// Get questions by group
const getQuestionsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 20, difficulty, category, sortBy = 'createdAt' } = req.query;

    // Check if group exists and user has access
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({
      userId,
      groupId,
      status: 'active'
    });

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'Access denied to private group' });
    }

    // Build query
    const query = { groupId, status: 'active' };
    if (difficulty) query.difficulty = difficulty;
    if (category) query.category = category;

    // Sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy === 'views') sortOptions = { views: -1, createdAt: -1 };
    if (sortBy === 'likes') sortOptions = { 'likes.length': -1, createdAt: -1 };

    const questions = await Question.find(query)
      .populate('postedBy', 'name email avatar')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalQuestions = await Question.countDocuments(query);

    res.json({
      questions,
      totalQuestions,
      totalPages: Math.ceil(totalQuestions / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get questions by group error:', error);
    res.status(500).json({
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};

// Get question by ID
const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question ID' });
    }

    const question = await Question.findById(id)
      .populate('postedBy', 'name email avatar')
      .populate('solutions.userId', 'name email avatar');

    if (!question || question.status !== 'active') {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check group access
    const group = await Group.findById(question.groupId);
    const membership = await GroupMember.findOne({
      userId,
      groupId: question.groupId,
      status: 'active'
    });

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Increment view count (but not for the poster)
    if (question.postedBy._id.toString() !== userId) {
      question.views += 1;
      await question.save();
    }

    res.json({ question });
  } catch (error) {
    console.error('Get question by ID error:', error);
    res.status(500).json({
      message: 'Failed to fetch question',
      error: error.message
    });
  }
};

// Update question
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question ID' });
    }

    const question = await Question.findById(id);
    if (!question || question.status !== 'active') {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the poster or admin
    const membership = await GroupMember.findOne({
      userId,
      groupId: question.groupId,
      status: 'active'
    });

    if (question.postedBy.toString() !== userId && membership?.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'difficulty', 'category', 'tags'];
    const actualUpdates = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        actualUpdates[field] = updates[field];
      }
    });

    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      actualUpdates,
      { new: true, runValidators: true }
    ).populate('postedBy', 'name email avatar');

    res.json({
      message: 'Question updated successfully',
      question: updatedQuestion
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      message: 'Failed to update question',
      error: error.message
    });
  }
};

// Delete question
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question ID' });
    }

    const question = await Question.findById(id);
    if (!question || question.status !== 'active') {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the poster or admin
    const membership = await GroupMember.findOne({
      userId,
      groupId: question.groupId,
      status: 'active'
    });

    if (question.postedBy.toString() !== userId && membership?.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // Soft delete
    question.status = 'deleted';
    await question.save();

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      message: 'Failed to delete question',
      error: error.message
    });
  }
};

// Rate difficulty
const rateDifficulty = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.userId;

    if (!['Easy', 'Medium', 'Hard'].includes(rating)) {
      return res.status(400).json({ message: 'Invalid rating' });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user already rated
    const existingRating = question.difficultyRatings.find(
      r => r.userId.toString() === userId
    );

    if (existingRating) {
      existingRating.rating = rating;
    } else {
      question.difficultyRatings.push({ userId, rating });
    }

    await question.save();
    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Rate difficulty error:', error);
    res.status(500).json({
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

// Toggle like
const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const likeIndex = question.likes.findIndex(
      like => like.userId.toString() === userId
    );

    if (likeIndex > -1) {
      question.likes.splice(likeIndex, 1);
    } else {
      question.likes.push({ userId });
    }

    await question.save();
    res.json({
      message: 'Like toggled successfully',
      liked: likeIndex === -1,
      likeCount: question.likes.length
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      message: 'Failed to toggle like',
      error: error.message
    });
  }
};

// Add solution
const addSolution = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, language, explanation, timeComplexity, spaceComplexity } = req.body;
    const userId = req.user.userId;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.solutions.push({
      userId,
      code,
      language,
      explanation,
      timeComplexity,
      spaceComplexity
    });

    await question.save();
    await question.populate('solutions.userId', 'name email avatar');

    res.status(201).json({
      message: 'Solution added successfully',
      solution: question.solutions[question.solutions.length - 1]
    });
  } catch (error) {
    console.error('Add solution error:', error);
    res.status(500).json({
      message: 'Failed to add solution',
      error: error.message
    });
  }
};

// Get solutions for a question
const getSolutions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const question = await Question.findById(id)
      .populate('solutions.userId', 'name email avatar')
      .select('solutions');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      solutions: question.solutions
    });
  } catch (error) {
    console.error('Get solutions error:', error);
    res.status(500).json({
      message: 'Failed to fetch solutions',
      error: error.message
    });
  }
};

// Search questions
const searchQuestions = async (req, res) => {
  try {
    const { q, groupId, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    let query = {
      status: 'active',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (groupId) {
      query.groupId = groupId;
    }

    const questions = await Question.find(query)
      .populate('postedBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ questions });
  } catch (error) {
    console.error('Search questions error:', error);
    res.status(500).json({
      message: 'Failed to search questions',
      error: error.message
    });
  }
};

// Add these functions to your existing questionController.js

// Submit member response for a question
const submitMemberResponse = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { status, difficultyRating, timeToSolve, notes } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!status || !difficultyRating) {
      return res.status(400).json({
        message: 'Status and difficulty rating are required'
      });
    }

    // Validate question exists
    const question = await Question.findById(questionId);
    if (!question || question.status !== 'active') {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({
      userId,
      groupId: question.groupId,
      status: 'active'
    });

    if (!membership) {
      return res.status(403).json({
        message: 'You must be a member of this group to submit responses'
      });
    }

    // Check if user already submitted a response
    const existingResponseIndex = question.memberResponses.findIndex(
      response => response.userId.toString() === userId
    );

    const responseData = {
      userId,
      status,
      difficultyRating,
      timeToSolve: timeToSolve || null,
      notes: notes?.trim() || '',
      submittedAt: new Date()
    };

    if (existingResponseIndex !== -1) {
      // Update existing response
      question.memberResponses[existingResponseIndex] = responseData;
    } else {
      // Add new response
      question.memberResponses.push(responseData);
    }

    await question.save();

    // Populate the response with user info
    await question.populate('memberResponses.userId', 'name email avatar');

    const userResponse = question.memberResponses.find(
      response => response.userId._id.toString() === userId
    );

    res.json({
      message: existingResponseIndex !== -1 ? 'Response updated successfully' : 'Response submitted successfully',
      response: userResponse,
      questionStats: {
        solvedCount: question.solvedCount,
        attemptedCount: question.attemptedCount,
        totalResponses: question.memberResponses.length,
        averageTimeToSolve: question.averageTimeToSolve,
        memberDifficultyRating: question.memberDifficultyRating
      }
    });
  } catch (error) {
    console.error('Submit member response error:', error);
    res.status(500).json({
      message: 'Failed to submit response',
      error: error.message
    });
  }
};

// Get user's response for a specific question
const getUserQuestionResponse = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.userId;

    const question = await Question.findById(questionId)
      .populate('memberResponses.userId', 'name email avatar');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const userResponse = question.memberResponses.find(
      response => response.userId._id.toString() === userId
    );

    res.json({
      response: userResponse || null,
      questionStats: {
        solvedCount: question.solvedCount,
        attemptedCount: question.attemptedCount,
        totalResponses: question.memberResponses.length,
        averageTimeToSolve: question.averageTimeToSolve,
        memberDifficultyRating: question.memberDifficultyRating
      }
    });
  } catch (error) {
    console.error('Get user question response error:', error);
    res.status(500).json({
      message: 'Failed to fetch response',
      error: error.message
    });
  }
};

// Get all responses for a question (allow all group members to view)
const getQuestionMemberResponses = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.userId;

    const question = await Question.findById(questionId)
      .populate('memberResponses.userId', 'name email avatar')
      .populate('postedBy', 'name email avatar');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is a member of the group (changed from admin-only to all members)
    const membership = await GroupMember.findOne({
      userId,
      groupId: question.groupId,
      status: 'active'
    });

    if (!membership) {
      return res.status(403).json({
        message: 'You must be a member of this group to view responses'
      });
    }

    // Group responses by status
    const responsesByStatus = {
      solved: question.memberResponses.filter(r => r.status === 'solved'),
      attempted: question.memberResponses.filter(r => r.status === 'attempted'),
      stuck: question.memberResponses.filter(r => r.status === 'stuck')
    };

    // Calculate difficulty distribution
    const difficultyDistribution = question.memberResponses.reduce((acc, response) => {
      acc[response.difficultyRating] = (acc[response.difficultyRating] || 0) + 1;
      return acc;
    }, {});

    // Calculate average time to solve
    const solvedResponses = question.memberResponses.filter(r => r.status === 'solved' && r.timeToSolve);
    const averageTimeToSolve = solvedResponses.length > 0
      ? Math.round(solvedResponses.reduce((sum, r) => sum + r.timeToSolve, 0) / solvedResponses.length)
      : null;

    res.json({
      question: {
        id: question._id,
        title: question.title,
        difficulty: question.difficulty,
        postedBy: question.postedBy
      },
      responses: responsesByStatus,
      statistics: {
        totalResponses: question.memberResponses.length,
        solvedCount: question.memberResponses.filter(r => r.status === 'solved').length,
        attemptedCount: question.memberResponses.filter(r => r.status === 'attempted').length,
        stuckCount: question.memberResponses.filter(r => r.status === 'stuck').length,
        averageTimeToSolve,
        difficultyDistribution,
        memberDifficultyRating: calculateMemberDifficultyRating(question.memberResponses)
      }
    });
  } catch (error) {
    console.error('Get question member responses error:', error);
    res.status(500).json({
      message: 'Failed to fetch responses',
      error: error.message
    });
  }
};

// Update the getQuestionsByGroup to include response stats
const getQuestionsByGroupWithStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 20, difficulty, category, sortBy = 'createdAt' } = req.query;

    // Check if group exists and user has access
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({
      userId,
      groupId,
      status: 'active'
    });

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'Access denied to private group' });
    }

    // Build query
    const query = { groupId, status: 'active' };
    if (difficulty) query.difficulty = difficulty;
    if (category) query.category = category;

    // Sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy === 'views') sortOptions = { views: -1, createdAt: -1 };
    if (sortBy === 'likes') sortOptions = { 'likes.length': -1, createdAt: -1 };
    if (sortBy === 'solved') sortOptions = { 'memberResponses.length': -1, createdAt: -1 };

    const questions = await Question.find(query)
      .populate('postedBy', 'name email avatar')
      .populate('memberResponses.userId', 'name email avatar')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Add response statistics to each question
    const questionsWithStats = questions.map(question => {
      const memberResponses = question.memberResponses || [];
      const userResponse = memberResponses.find(r => r.userId._id.toString() === userId);

      return {
        ...question,
        solvedCount: memberResponses.filter(r => r.status === 'solved').length,
        attemptedCount: memberResponses.filter(r => r.status === 'attempted').length,
        totalResponses: memberResponses.length,
        userResponse: userResponse || null,
        memberDifficultyRating: calculateMemberDifficultyRating(memberResponses)
      };
    });

    const totalQuestions = await Question.countDocuments(query);

    res.json({
      questions: questionsWithStats,
      totalQuestions,
      totalPages: Math.ceil(totalQuestions / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get questions by group with stats error:', error);
    res.status(500).json({
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};

// Helper function to calculate member difficulty rating
function calculateMemberDifficultyRating(memberResponses) {
  if (memberResponses.length === 0) return null;

  const ratings = memberResponses.map(r => {
    switch (r.difficultyRating) {
      case 'Easy': return 1;
      case 'Medium': return 2;
      case 'Hard': return 3;
      default: return 2;
    }
  });

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  if (avg <= 1.5) return 'Easy';
  if (avg <= 2.5) return 'Medium';
  return 'Hard';
}

// Update your module.exports to include the new functions
module.exports = {
  createQuestion,
  getQuestionsByGroup: getQuestionsByGroupWithStats, // Updated version
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  rateDifficulty,
  toggleLike,
  addSolution,
  getSolutions,
  searchQuestions,
  // New functions for member responses
  submitMemberResponse,
  getUserQuestionResponse,
  getQuestionMemberResponses
};