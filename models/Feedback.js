const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question', 
    required: true 
  },
  type: {
    type: String,
    enum: ['difficulty_rating', 'question_review', 'solution_review', 'general'],
    default: 'difficulty_rating'
  },
  votedDifficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: function() {
      return this.type === 'difficulty_rating';
    }
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    validate: {
      validator: function(v) {
        return this.type !== 'difficulty_rating' || v == null || (v >= 1 && v <= 5);
      },
      message: 'Rating must be between 1 and 5'
    }
  },
  comment: { 
    type: String,
    maxlength: 1000,
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 30
  }],
  isAnonymous: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'hidden', 'reported', 'deleted'],
    default: 'active'
  },
  helpfulVotes: {
    upvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }],
    downvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  reportedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'offensive', 'irrelevant', 'other'],
      required: true
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderatorNotes: {
    type: String,
    maxlength: 500
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index to prevent duplicate feedback from same user for same question
feedbackSchema.index({ userId: 1, questionId: 1, type: 1 }, { unique: true });

// Other indexes for better performance
feedbackSchema.index({ questionId: 1, status: 1 });
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ type: 1 });
feedbackSchema.index({ votedDifficulty: 1 });
feedbackSchema.index({ createdAt: -1 });

// Virtual for helpful score
feedbackSchema.virtual('helpfulScore').get(function() {
  const upvotes = this.helpfulVotes.upvotes ? this.helpfulVotes.upvotes.length : 0;
  const downvotes = this.helpfulVotes.downvotes ? this.helpfulVotes.downvotes.length : 0;
  return upvotes - downvotes;
});

// Pre-save middleware
feedbackSchema.pre('save', function(next) {
  this.lastModified = Date.now();
  next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);