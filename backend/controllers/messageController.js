//file: backend/controllers/messageController.js
const { query } = require('../config/database');

// Get messages for a group
const getGroupMessages = async (req, res) => {
    try {
        const { group_id } = req.params;
        const userId = req.user.id;

        // Check if user is a member of the group
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [group_id, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Get messages
        const result = await query(`
            SELECT 
                m.*,
                s.name as sender_name,
                s.college_name as sender_college
            FROM messages m
            JOIN students s ON m.sender_id = s.id
            WHERE m.group_id = $1
            ORDER BY m.created_at ASC
        `, [group_id]);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: error.message
        });
    }
};

// Send a message (used by REST API, Socket.io handles real-time)
const sendMessage = async (req, res) => {
    try {
        const { group_id, message_text } = req.body;
        const senderId = req.user.id;

        if (!group_id || !message_text) {
            return res.status(400).json({
                success: false,
                message: 'Group ID and message text are required'
            });
        }

        // Check if user is a member of the group
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [group_id, senderId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Insert message
        const result = await query(
            'INSERT INTO messages (group_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING *',
            [group_id, senderId, message_text]
        );

        // Get sender details
        const senderResult = await query(
            'SELECT name, college_name FROM students WHERE id = $1',
            [senderId]
        );

        const message = {
            ...result.rows[0],
            sender_name: senderResult.rows[0].name,
            sender_college: senderResult.rows[0].college_name
        };

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: message
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    }
};

// Delete a message
const deleteMessage = async (req, res) => {
    try {
        const { message_id } = req.params;
        const userId = req.user.id;

        // Check if message exists and user is the sender
        const messageResult = await query(
            'SELECT * FROM messages WHERE id = $1',
            [message_id]
        );

        if (messageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        const message = messageResult.rows[0];

        if (message.sender_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own messages'
            });
        }

        // Delete message
        await query('DELETE FROM messages WHERE id = $1', [message_id]);

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: error.message
        });
    }
};

module.exports = {
    getGroupMessages,
    sendMessage,
    deleteMessage
};