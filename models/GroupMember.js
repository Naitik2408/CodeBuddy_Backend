const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  groupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group', 
    required: true 
  },
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'banned', 'left'],
    default: 'active'
  },
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  permissions: {
    canPostQuestions: {
      type: Boolean,
      default: true
    },
    canComment: {
      type: Boolean,
      default: true
    },
    canInviteMembers: {
      type: Boolean,
      default: false
    }
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  banReason: String,
  bannedAt: Date,
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  mutedUntil: Date
}, { 
  timestamps: true 
});

// Compound index to ensure unique user-group combination
groupMemberSchema.index({ userId: 1, groupId: 1 }, { unique: true });
groupMemberSchema.index({ groupId: 1, status: 1 });
groupMemberSchema.index({ userId: 1, status: 1 });

// Update last active time
groupMemberSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

module.exports = mongoose.model('GroupMember', groupMemberSchema);