//file: backend/controllers/groupController.js
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Create a new group
const createGroup = async (req, res) => {
    try {
        const { group_name, description, group_type, allowed_college } = req.body;
        const creatorId = req.user.id;
        const creatorCollege = req.user.college_name;

        // Validation
        if (!group_name || !group_type) {
            return res.status(400).json({
                success: false,
                message: 'Group name and type are required'
            });
        }

        if (!['public', 'private'].includes(group_type)) {
            return res.status(400).json({
                success: false,
                message: 'Group type must be either public or private'
            });
        }

        // Determine allowed college based on group type
        let finalAllowedCollege = null;

        if (group_type === 'private') {
            // If allowed_college is provided (other college selected)
            if (allowed_college && allowed_college.trim() !== '') {
                finalAllowedCollege = allowed_college.trim();
            } else {
                // Default to creator's college
                finalAllowedCollege = creatorCollege;
            }
        }

        // Create group
        const groupResult = await query(
            'INSERT INTO groups (group_name, description, group_type, allowed_college, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [group_name, description, group_type, finalAllowedCollege, creatorId]
        );

        const newGroup = groupResult.rows[0];

        // Add creator as first member
        await query(
            'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)',
            [newGroup.id, creatorId]
        );

        // Generate unique invite code
        const inviteCode = `${group_type.toUpperCase()}-${uuidv4().split('-')[0]}`;
        await query(
            'INSERT INTO group_invites (group_id, invite_code) VALUES ($1, $2)',
            [newGroup.id, inviteCode]
        );

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: {
                ...newGroup,
                invite_code: inviteCode
            }
        });

    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create group',
            error: error.message
        });
    }
};

// Get all groups (with filtering)
const getAllGroups = async (req, res) => {
    try {
        const userId = req.user.id;
        const userCollege = req.user.college_name;

        // Get all public groups + private groups that match user's college
        const result = await query(`
            SELECT 
                g.*,
                s.name as creator_name,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                (SELECT invite_code FROM group_invites WHERE group_id = g.id LIMIT 1) as invite_code,
                EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND student_id = $1) as is_member
            FROM groups g
            JOIN students s ON g.created_by = s.id
            WHERE g.group_type = 'public' 
               OR (g.group_type = 'private' AND g.allowed_college = $2)
            ORDER BY g.created_at DESC
        `, [userId, userCollege]);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch groups',
            error: error.message
        });
    }
};

// Get user's joined groups
const getMyGroups = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(`
            SELECT 
                g.*,
                s.name as creator_name,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                (SELECT invite_code FROM group_invites WHERE group_id = g.id LIMIT 1) as invite_code,
                gm.joined_at
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            JOIN students s ON g.created_by = s.id
            WHERE gm.student_id = $1
            ORDER BY gm.joined_at DESC
        `, [userId]);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get my groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your groups',
            error: error.message
        });
    }
};

// Join group via invite code
const joinGroupByInvite = async (req, res) => {
    try {
        const { invite_code } = req.body;
        const userId = req.user.id;
        const userCollege = req.user.college_name;

        if (!invite_code) {
            return res.status(400).json({
                success: false,
                message: 'Invite code is required'
            });
        }

        // Find group by invite code
        const inviteResult = await query(
            'SELECT group_id FROM group_invites WHERE invite_code = $1',
            [invite_code]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid invite code'
            });
        }

        const groupId = inviteResult.rows[0].group_id;

        // Get group details
        const groupResult = await query(
            'SELECT * FROM groups WHERE id = $1',
            [groupId]
        );

        const group = groupResult.rows[0];

        // Check if already a member
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [groupId, userId]
        );

        if (memberCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You are already a member of this group'
            });
        }

        // CRITICAL: College validation for private groups
        if (group.group_type === 'private' && group.allowed_college !== userCollege) {
            return res.status(403).json({
                success: false,
                message: `This group is restricted to ${group.allowed_college} students only`
            });
        }

        // Add user to group
        await query(
            'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)',
            [groupId, userId]
        );

        res.status(200).json({
            success: true,
            message: 'Successfully joined the group',
            data: group
        });

    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join group',
            error: error.message
        });
    }
};

// Join public group directly
const joinGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const userId = req.user.id;
        const userCollege = req.user.college_name;

        // Get group details
        const groupResult = await query(
            'SELECT * FROM groups WHERE id = $1',
            [group_id]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupResult.rows[0];

        // Check if already a member
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [group_id, userId]
        );

        if (memberCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You are already a member of this group'
            });
        }

        // CRITICAL: College validation for private groups
        if (group.group_type === 'private' && group.allowed_college !== userCollege) {
            return res.status(403).json({
                success: false,
                message: `This group is restricted to ${group.allowed_college} students only`
            });
        }

        // Add user to group
        await query(
            'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)',
            [group_id, userId]
        );

        res.status(200).json({
            success: true,
            message: 'Successfully joined the group',
            data: group
        });

    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join group',
            error: error.message
        });
    }
};

// Get group members
const getGroupMembers = async (req, res) => {
    try {
        const { group_id } = req.params;

        const result = await query(`
            SELECT 
                s.id,
                s.name,
                s.email,
                s.college_name,
                gm.joined_at,
                (g.created_by = s.id) as is_admin
            FROM group_members gm
            JOIN students s ON gm.student_id = s.id
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.group_id = $1
            ORDER BY is_admin DESC, gm.joined_at ASC
        `, [group_id]);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch group members',
            error: error.message
        });
    }
};

// Delete group (admin only)
const deleteGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const userId = req.user.id;

        // Check if user is the creator
        const groupResult = await query(
            'SELECT * FROM groups WHERE id = $1',
            [group_id]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupResult.rows[0];

        if (group.created_by !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can delete the group'
            });
        }

        // Delete group (cascade will handle related records)
        await query('DELETE FROM groups WHERE id = $1', [group_id]);

        res.status(200).json({
            success: true,
            message: 'Group deleted successfully'
        });

    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete group',
            error: error.message
        });
    }
};

module.exports = {
    createGroup,
    getAllGroups,
    getMyGroups,
    joinGroupByInvite,
    joinGroup,
    getGroupMembers,
    deleteGroup
};