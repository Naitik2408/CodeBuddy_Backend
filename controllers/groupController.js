const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description, isPrivate, category, tags, maxMembers } = req.body;
    const adminId = req.user.userId;

    // Validate required fields
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ message: 'Group name must be at least 3 characters long' });
    }

    // Check if user already has maximum number of groups as admin
    const existingGroups = await Group.countDocuments({ adminId, isActive: true });
    if (existingGroups >= 10) {
      return res.status(400).json({ message: 'You can only create up to 10 groups' });
    }

    // Create group
    const group = new Group({
      name: name.trim(),
      description: description?.trim(),
      isPrivate: isPrivate || false,
      adminId,
      category: category || 'General',
      tags: tags ? tags.map(tag => tag.trim().toLowerCase()) : [],
      maxMembers: maxMembers || 100
    });

    await group.save();

    // Add creator as admin member
    await GroupMember.create({
      userId: adminId,
      groupId: group._id,
      role: 'admin',
      status: 'active'
    });

    // Populate admin information
    await group.populate('adminId', 'name email avatar');

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Failed to create group', error: error.message });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.userId;

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    // Find group by invite code
    const group = await Group.findOne({
      inviteCode: inviteCode.trim().toUpperCase(),
      isActive: true
    }).populate('adminId', 'name email');

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code or group not found' });
    }

    // Check if user is already a member
    const existingMembership = await GroupMember.findOne({
      userId,
      groupId: group._id
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return res.status(400).json({ message: 'You are already a member of this group' });
      } else {
        // Reactivate membership
        existingMembership.status = 'active';
        existingMembership.joinedAt = new Date();
        await existingMembership.save();
      }
    } else {
      // Create new membership
      const newMembership = new GroupMember({
        userId,
        groupId: group._id,
        role: 'member',
        status: 'active',
        joinedAt: new Date()
      });
      await newMembership.save();
    }

    // Return the complete group object with the correct _id
    const groupResponse = {
      _id: group._id,
      name: group.name,
      description: group.description,
      category: group.category,
      isPrivate: group.isPrivate,
      adminId: group.adminId,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.status(200).json({
      message: 'Successfully joined the group',
      group: groupResponse,
      membership: {
        role: existingMembership?.role || 'member',
        joinedAt: existingMembership?.joinedAt || new Date()
      }
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      message: 'Failed to join group',
      error: error.message
    });
  }
};

// Get user's groups
const getUserGroups = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status = 'active' } = req.query;

    const memberships = await GroupMember.find({ userId, status })
      .populate({
        path: 'groupId',
        match: { isActive: true },
        populate: {
          path: 'adminId',
          select: 'name email avatar'
        }
      })
      .sort({ joinedAt: -1 });

    // Filter out null groups and format response
    const groups = memberships
      .filter(membership => membership.groupId)
      .map(membership => {
        const group = membership.groupId;
        return {
          _id: group._id, // Ensure _id is properly set
          name: group.name,
          description: group.description,
          category: group.category,
          isPrivate: group.isPrivate,
          adminId: group.adminId,
          inviteCode: group.inviteCode,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          userRole: membership.role, // User's role in this group
          joinedAt: membership.joinedAt,
          memberCount: 0, // Will be populated by a separate query if needed
          questionCount: 0 // Will be populated by a separate query if needed
        };
      });

    // Get member counts for each group
    for (let group of groups) {
      const memberCount = await GroupMember.countDocuments({
        groupId: group._id,
        status: 'active'
      });
      group.memberCount = memberCount;

      // Get question count if you have a Question model
      try {
        const Question = require('../models/Question');
        const questionCount = await Question.countDocuments({
          groupId: group._id,
          status: 'active'
        });
        group.questionCount = questionCount;
      } catch (err) {
        // Question model might not exist yet
        group.questionCount = 0;
      }
    }

    res.json({ groups });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({
      message: 'Failed to fetch groups',
      error: error.message
    });
  }
};

// Update the getGroupDetails method to match what frontend expects
const getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(id)
      .populate('adminId', 'name email avatar')
      .populate('moderators', 'name email avatar');

    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    const membership = await GroupMember.findOne({ userId, groupId: id });

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'This is a private group' });
    }

    // Return group directly (not nested in group property)
    res.json({
      ...group.toObject(),
      userRole: membership?.role || null,
      userStatus: membership?.status || null
    });
  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({ message: 'Failed to fetch group details', error: error.message });
  }
};

// Update group
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, tags, maxMembers, settings } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin or moderator
    const membership = await GroupMember.findOne({ userId, groupId: id });
    if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
      return res.status(403).json({ message: 'Only admins and moderators can update group details' });
    }

    // Update fields
    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description?.trim();
    if (category) group.category = category;
    if (tags) group.tags = tags.map(tag => tag.trim().toLowerCase());
    if (maxMembers) group.maxMembers = maxMembers;
    if (settings && membership.role === 'admin') {
      group.settings = { ...group.settings, ...settings };
    }

    await group.save();

    res.json({
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group', error: error.message });
  }
};

// Leave group
const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({ userId, groupId: id });
    if (!membership) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    // Check if user is the admin
    if (membership.role === 'admin') {
      const otherMembers = await GroupMember.countDocuments({
        groupId: id,
        status: 'active',
        userId: { $ne: userId }
      });

      if (otherMembers > 0) {
        return res.status(400).json({
          message: 'You must transfer admin role to another member before leaving'
        });
      } else {
        // Delete group if admin is the only member
        group.isActive = false;
        await group.save();
      }
    }

    // Update membership status
    membership.status = 'left';
    await membership.save();

    // Update group statistics
    group.statistics.totalMembers = Math.max(0, group.statistics.totalMembers - 1);
    await group.save();

    res.json({ message: 'Successfully left the group' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group', error: error.message });
  }
};

// Remove member (admin only)
const removeMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    // Check if user is admin
    const adminMembership = await GroupMember.findOne({
      userId,
      groupId: id,
      role: 'admin'
    });

    if (!adminMembership) {
      return res.status(403).json({ message: 'Only group admins can remove members' });
    }

    // Find member to remove
    const memberToRemove = await GroupMember.findOne({
      userId: memberId,
      groupId: id
    });

    if (!memberToRemove) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (memberToRemove.role === 'admin') {
      return res.status(400).json({ message: 'Cannot remove group admin' });
    }

    // Update member status
    memberToRemove.status = 'banned';
    memberToRemove.banReason = reason;
    memberToRemove.bannedAt = new Date();
    memberToRemove.bannedBy = userId;
    await memberToRemove.save();

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Failed to remove member', error: error.message });
  }
};

// Generate new invite code
const generateInviteCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { expiryHours } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user has permission
    const membership = await GroupMember.findOne({ userId, groupId: id });
    if (!membership ||
      (membership.role !== 'admin' &&
        (membership.role !== 'member' || !group.settings.allowMemberInvites))) {
      return res.status(403).json({ message: 'You do not have permission to generate invite codes' });
    }

    // Generate new invite code
    const crypto = require('crypto');
    group.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    if (expiryHours) {
      group.inviteCodeExpiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    } else {
      group.inviteCodeExpiry = undefined;
    }

    await group.save();

    res.json({
      message: 'New invite code generated',
      inviteCode: group.inviteCode,
      expiresAt: group.inviteCodeExpiry
    });
  } catch (error) {
    console.error('Generate invite code error:', error);
    res.status(500).json({ message: 'Failed to generate invite code', error: error.message });
  }
};


const getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ userId, groupId: id, status: 'active' });
    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const members = await GroupMember.find({
      groupId: id,
      status: 'active'
    })
      .populate('userId', 'name email avatar')
      .sort({ joinedAt: 1 });

    // Import Question model
    const Question = require('../models/Question');

    // Calculate real statistics for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        try {

          // Get total questions in the group
          const totalQuestions = await Question.countDocuments({
            groupId: id,
            status: 'active'
          });


          // Get questions with member responses
          const questionsWithResponses = await Question.find({
            groupId: id,
            status: 'active',
            'memberResponses.userId': member.userId._id
          });

          // Calculate statistics
          const totalResponses = questionsWithResponses.length;
          const solvedCount = questionsWithResponses.filter(q =>
            q.memberResponses.some(r =>
              r.userId.toString() === member.userId._id.toString() && r.status === 'solved'
            )
          ).length;

          const successRate = totalResponses > 0 ? Math.round((solvedCount / totalResponses) * 100) : 0;

          // Calculate current streak
          const recentQuestions = await Question.find({
            groupId: id,
            status: 'active',
            'memberResponses.userId': member.userId._id
          })
            .sort({ createdAt: -1 })
            .limit(20);

          let currentStreak = 0;
          for (const question of recentQuestions) {
            const response = question.memberResponses.find(r =>
              r.userId.toString() === member.userId._id.toString()
            );
            if (response && response.status === 'solved') {
              currentStreak++;
            } else {
              break;
            }
          }

          // Calculate average time to solve
          const solvedQuestions = questionsWithResponses.filter(q =>
            q.memberResponses.some(r =>
              r.userId.toString() === member.userId._id.toString() &&
              r.status === 'solved' &&
              r.timeToSolve
            )
          );

          const averageTimeToSolve = solvedQuestions.length > 0
            ? Math.round(
              solvedQuestions.reduce((sum, q) => {
                const response = q.memberResponses.find(r =>
                  r.userId.toString() === member.userId._id.toString()
                );
                return sum + (response.timeToSolve || 0);
              }, 0) / solvedQuestions.length
            )
            : null;

          const memberStats = {
            problemsSolved: solvedCount,
            successRate: successRate,
            currentStreak: currentStreak,
            totalResponses: totalResponses,
            totalQuestions: totalQuestions,
            averageTimeToSolve: averageTimeToSolve,
            questionsAttempted: totalResponses,
            rank: null // Will be calculated after sorting
          };

        

          return {
            _id: member._id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            lastActive: member.lastActive || member.joinedAt,
            stats: memberStats // Make sure this is included
          };
        } catch (error) {
          console.error(`Error calculating stats for member ${member.userId._id}:`, error);
          // Return member with default stats if calculation fails
          return {
            _id: member._id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            lastActive: member.lastActive || member.joinedAt,
            stats: {
              problemsSolved: 0,
              successRate: 0,
              currentStreak: 0,
              totalResponses: 0,
              totalQuestions: 0,
              averageTimeToSolve: null,
              questionsAttempted: 0,
              rank: null
            }
          };
        }
      })
    );

    // Calculate ranks based on problems solved
    const sortedMembers = [...membersWithStats].sort((a, b) =>
      (b.stats.problemsSolved || 0) - (a.stats.problemsSolved || 0)
    );

    sortedMembers.forEach((member, index) => {
      const originalMember = membersWithStats.find(m => m._id.toString() === member._id.toString());
      if (originalMember && originalMember.stats) {
        originalMember.stats.rank = index + 1;
      }
    });


    res.json({
      members: membersWithStats
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ message: 'Failed to fetch members', error: error.message });
  }
};

// Add this to your groupController.js
const getGroupQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // Check if group exists and user has access
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({
      userId,
      groupId: id,
      status: 'active'
    });

    if (!membership && group.isPrivate) {
      return res.status(403).json({ message: 'Access denied to private group' });
    }

    // Get questions from Question model
    const Question = require('../models/Question');
    const questions = await Question.find({
      groupId: id,
      status: 'active'
    })
      .populate('postedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      questions: questions
    });
  } catch (error) {
    console.error('Get group questions error:', error);
    res.status(500).json({
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};



module.exports = {
  createGroup,
  joinGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  leaveGroup,
  removeMember,
  generateInviteCode,
  getGroupMembers, // ADD THIS
  getGroupQuestions // ADD THIS
};