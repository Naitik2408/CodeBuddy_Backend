const Feedback = require('../models/Feedback');
const Question = require('../models/Question');
const User = require('../models/User');
const mongoose = require('mongoose');

// Submit feedback
const submitFeedback = async (req, res) => {
  try {
    const { questionId, type, votedDifficulty, rating, comment, tags, isAnonymous } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!questionId || !type) {
      return res.status(400).json({ message: 'Question ID and feedback type are required' });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ message: 'Invalid question ID' });
    }

    // Check if question exists
    const question = await Question.findById(questionId);
    if (!question || !question.isActive) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Validate difficulty rating type
    if (type === 'difficulty_rating' && !votedDifficulty) {
      return res.status(400).json({ message: 'Voted difficulty is required for difficulty rating' });
    }

    // Validate rating for review types
    if ((type === 'question_review' || type === 'solution_review') && (!rating || rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating between 1-5 is required for reviews' });
    }

    // Check for existing feedback of same type
    const existingFeedback = await Feedback.findOne({ 
      userId, 
      questionId, 
      type,
      status: { $ne: 'deleted' }
    });

    if (existingFeedback) {
      return res.status(400).json({ 
        message: 'You have already submitted this type of feedback for this question' 
      });
    }

    // Create feedback
    const feedbackData = {
      userId,
      questionId,
      type,
      isAnonymous: isAnonymous || false,
      comment: comment?.trim()
    };

    if (votedDifficulty) feedbackData.votedDifficulty = votedDifficulty;
    if (rating) feedbackData.rating = rating;
    if (tags) feedbackData.tags = tags.map(tag => tag.trim().toLowerCase());

    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // Populate user information (unless anonymous)
    await feedback.populate([
      { 
        path: 'userId', 
        select: feedbackData.isAnonymous ? '' : 'name avatar' 
      },
      { 
        path: 'questionId', 
        select: 'title' 
      }
    ]);

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already submitted this type of feedback for this question' });
    }
    res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
};

// Get feedback for a question
const getQuestionFeedback = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { type, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ message: 'Invalid question ID' });
    }

    // Build filter
    const filter = { 
      questionId, 
      status: 'active' 
    };
    
    if (type) filter.type = type;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const feedbacks = await Feedback.find(filter)
      .populate('userId', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Hide user info for anonymous feedback
    const processedFeedbacks = feedbacks.map(feedback => {
      if (feedback.isAnonymous) {
        feedback.userId = { name: 'Anonymous', avatar: '' };
      }
      return feedback;
    });

    const total = await Feedback.countDocuments(filter);

    // Calculate statistics
    const stats = await Feedback.aggregate([
      { $match: { questionId: new mongoose.Types.ObjectId(questionId), status: 'active' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedbacks: { $sum: 1 },
          difficultyBreakdown: {
            $push: {
              $cond: [
                { $eq: ['$type', 'difficulty_rating'] },
                '$votedDifficulty',
                null
              ]
            }
          }
        }
      }
    ]);

    res.json({
      feedbacks: processedFeedbacks,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalFeedbacks: total,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      },
      statistics: stats[0] || { averageRating: 0, totalFeedbacks: 0, difficultyBreakdown: [] }
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Failed to fetch feedback', error: error.message });
  }
};

// Get user's feedback
const getUserFeedback = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, type } = req.query;

    const filter = { 
      userId, 
      status: { $ne: 'deleted' } 
    };
    
    if (type) filter.type = type;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const feedbacks = await Feedback.find(filter)
      .populate('questionId', 'title difficulty category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Feedback.countDocuments(filter);

    res.json({
      feedbacks,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalFeedbacks: total,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({ message: 'Failed to fetch user feedback', error: error.message });
  }
};

// Update feedback
const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating, tags } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check ownership
    if (feedback.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only update your own feedback' });
    }

    // Check if feedback is still editable (within 24 hours)
    const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - feedback.createdAt.getTime() > editTimeLimit) {
      return res.status(400).json({ message: 'Feedback can only be edited within 24 hours of submission' });
    }

    // Update fields
    if (comment !== undefined) feedback.comment = comment?.trim();
    if (rating) feedback.rating = rating;
    if (tags) feedback.tags = tags.map(tag => tag.trim().toLowerCase());

    await feedback.save();

    await feedback.populate([
      { path: 'userId', select: feedback.isAnonymous ? '' : 'name avatar' },
      { path: 'questionId', select: 'title' }
    ]);

    res.json({
      message: 'Feedback updated successfully',
      feedback
    });
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ message: 'Failed to update feedback', error: error.message });
  }
};

// Delete feedback
const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check ownership
    if (feedback.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only delete your own feedback' });
    }

    // Soft delete
    feedback.status = 'deleted';
    await feedback.save();

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ message: 'Failed to delete feedback', error: error.message });
  }
};

// Vote on feedback helpfulness
const voteOnFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ message: 'Vote type must be upvote or downvote' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback || feedback.status !== 'active') {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Cannot vote on own feedback
    if (feedback.userId.toString() === userId) {
      return res.status(400).json({ message: 'You cannot vote on your own feedback' });
    }

    // Remove existing votes from user
    feedback.helpfulVotes.upvotes = feedback.helpfulVotes.upvotes.filter(
      vote => vote.user.toString() !== userId
    );
    feedback.helpfulVotes.downvotes = feedback.helpfulVotes.downvotes.filter(
      vote => vote.user.toString() !== userId
    );

    // Add new vote
    if (voteType === 'upvote') {
      feedback.helpfulVotes.upvotes.push({ user: userId });
    } else {
      feedback.helpfulVotes.downvotes.push({ user: userId });
    }

    await feedback.save();

    res.json({
      message: `Feedback ${voteType}d successfully`,
      helpfulScore: feedback.helpfulScore
    });
  } catch (error) {
    console.error('Vote on feedback error:', error);
    res.status(500).json({ message: 'Failed to vote on feedback', error: error.message });
  }
};

// Report feedback
const reportFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.userId;

    if (!reason) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user already reported this feedback
    const existingReport = feedback.reportedBy.find(report => report.user.toString() === userId);
    if (existingReport) {
      return res.status(400).json({ message: 'You have already reported this feedback' });
    }

    feedback.reportedBy.push({
      user: userId,
      reason,
      description
    });

    // Mark as reported if it has 3 or more reports
    if (feedback.reportedBy.length >= 3) {
      feedback.status = 'reported';
    }

    await feedback.save();

    res.json({ message: 'Feedback reported successfully' });
  } catch (error) {
    console.error('Report feedback error:', error);
    res.status(500).json({ message: 'Failed to report feedback', error: error.message });
  }
};

module.exports = {
  submitFeedback,
  getQuestionFeedback,
  getUserFeedback,
  updateFeedback,
  deleteFeedback,
  voteOnFeedback,
  reportFeedback
};