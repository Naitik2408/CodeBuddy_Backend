const mongoose = require('mongoose');
const crypto = require('crypto');

const groupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100,
    minlength: 3
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: { 
    type: String, 
    unique: true, // This creates an index automatically
    sparse: true
  },
  maxMembers: {
    type: Number,
    default: 100,
    max: 1000
  },
  category: {
    type: String,
    enum: ['Study Group', 'Programming', 'Interview Prep', 'Project Team', 'General', 'Other'],
    default: 'General'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 20
  }],
  avatar: {
    type: String,
    default: ''
  },
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    requireAdminApproval: {
      type: Boolean,
      default: false
    },
    allowQuestionPosting: {
      type: Boolean,
      default: true
    },
    muteMembers: {
      type: Boolean,
      default: false
    }
  },
  statistics: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    totalMembers: {
      type: Number,
      default: 1
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  inviteCodeExpiry: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate invite code before saving
groupSchema.pre('save', function(next) {
  if (this.isNew && !this.inviteCode) {
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for member count
groupSchema.virtual('memberCount', {
  ref: 'GroupMember',
  localField: '_id',
  foreignField: 'groupId',
  count: true
});

// Indexes for better performance (no duplicates)
groupSchema.index({ adminId: 1 });
groupSchema.index({ category: 1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ createdAt: -1 });
groupSchema.index({ 'statistics.lastActivity': -1 });

module.exports = mongoose.model('Group', groupSchema);