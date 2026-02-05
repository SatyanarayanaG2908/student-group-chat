//file: backend/routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const {
    createGroup,
    getAllGroups,
    getMyGroups,
    joinGroupByInvite,
    joinGroup,
    getGroupMembers,
    deleteGroup
} = require('../controllers/groupController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Group CRUD
router.post('/create', createGroup);
router.get('/all', getAllGroups);
router.get('/my-groups', getMyGroups);
router.get('/:group_id/members', getGroupMembers);
router.delete('/:group_id', deleteGroup);

// Joining groups
router.post('/join-invite', joinGroupByInvite);
router.post('/:group_id/join', joinGroup);

module.exports = router;