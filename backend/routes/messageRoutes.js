//file: backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const {
    getGroupMessages,
    sendMessage,
    deleteMessage
} = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

router.get('/:group_id', getGroupMessages);
router.post('/send', sendMessage);
router.delete('/:message_id', deleteMessage);

// NEW: Bulk delete messages (for delete for everyone feature)
router.post('/delete', async (req, res) => {
    try {
        const { messageIds, groupId } = req.body;
        const { pool } = require('../config/database');

        // Verify user is member of the group
        const memberCheck = await pool.query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [groupId, req.user.id]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Delete messages
        await pool.query(
            'DELETE FROM messages WHERE id = ANY($1) AND group_id = $2',
            [messageIds, groupId]
        );

        res.json({ success: true, message: 'Messages deleted' });
    } catch (error) {
        console.error('Delete messages error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;