//file: backend/routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const {
    upload,
    uploadFile,
    getGroupFiles,
    downloadFile
} = require('../controllers/fileController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/:group_id', getGroupFiles);
router.get('/download/:file_id', downloadFile);

module.exports = router;