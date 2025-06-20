const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  sourceUrl: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['Easy', 'Medium', 'Hard']
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  platform: {
    type: String,
    required: true,
    enum: ['LeetCode', 'HackerRank', 'CodeForces', 'GeeksforGeeks', 'InterviewBit', 'Other']
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Enhanced member responses for tracking who solved the question
  memberResponses: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['solved', 'attempted', 'stuck'],
      required: true
    },
    difficultyRating: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true
    },
    timeToSolve: {
      type: Number, // in minutes
      min: 0
    },
    notes: {
      type: String,
      maxlength: 500
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  difficultyRatings: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  solutions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    code: String,
    language: String,
    explanation: String,
    timeComplexity: String,
    spaceComplexity: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for better performance
questionSchema.index({ groupId: 1, createdAt: -1 });
questionSchema.index({ postedBy: 1 });
questionSchema.index({ category: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ 'memberResponses.userId': 1 });
questionSchema.index({ title: 'text', description: 'text' });

// Virtual for solved count
questionSchema.virtual('solvedCount').get(function() {
  return this.memberResponses.filter(response => response.status === 'solved').length;
});

// Virtual for attempted count
questionSchema.virtual('attemptedCount').get(function() {
  return this.memberResponses.filter(response => response.status === 'attempted').length;
});

// Virtual for average difficulty rating from member responses
questionSchema.virtual('memberDifficultyRating').get(function() {
  if (this.memberResponses.length === 0) return this.difficulty;
  
  const ratings = this.memberResponses.map(r => {
    switch(r.difficultyRating) {
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
});

// Virtual for average time to solve
questionSchema.virtual('averageTimeToSolve').get(function() {
  const solvedResponses = this.memberResponses.filter(r => r.status === 'solved' && r.timeToSolve);
  if (solvedResponses.length === 0) return null;
  
  const totalTime = solvedResponses.reduce((sum, response) => sum + response.timeToSolve, 0);
  return Math.round(totalTime / solvedResponses.length);
});

// Include virtuals when converting to JSON
questionSchema.set('toJSON', { virtuals: true });
questionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema);