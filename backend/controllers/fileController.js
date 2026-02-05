
//file: backend/controllers/fileController.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

// File filter - ACCEPT ALL FILE TYPES
const fileFilter = (req, file, cb) => {
    // Accept all file types
    cb(null, true);
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size (increased from 10MB)
    },
    fileFilter: fileFilter
});

// Upload file to group
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { group_id } = req.body;
        const uploaderId = req.user.id;

        if (!group_id) {
            // Delete uploaded file if group_id is missing
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        // Check if user is a member of the group
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [group_id, uploaderId]
        );

        if (memberCheck.rows.length === 0) {
            // Delete uploaded file if user is not a member
            fs.unlinkSync(req.file.path);
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Save file info to database
        const result = await query(
            'INSERT INTO shared_files (group_id, uploader_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [
                group_id,
                uploaderId,
                req.file.originalname,
                req.file.path,
                req.file.mimetype,
                req.file.size
            ]
        );

        // Get uploader details
        const uploaderResult = await query(
            'SELECT name FROM students WHERE id = $1',
            [uploaderId]
        );

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                ...result.rows[0],
                uploader_name: uploaderResult.rows[0].name
            }
        });

    } catch (error) {
        console.error('File upload error:', error);
        // Delete file if database operation fails
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
};

// Get files for a group
const getGroupFiles = async (req, res) => {
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

        // Get files
        const result = await query(`
            SELECT 
                sf.*,
                s.name as uploader_name
            FROM shared_files sf
            JOIN students s ON sf.uploader_id = s.id
            WHERE sf.group_id = $1
            ORDER BY sf.uploaded_at DESC
        `, [group_id]);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch files',
            error: error.message
        });
    }
};

// Download a file
const downloadFile = async (req, res) => {
    try {
        const { file_id } = req.params;
        const userId = req.user.id;

        // Get file details
        const fileResult = await query(
            'SELECT * FROM shared_files WHERE id = $1',
            [file_id]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const file = fileResult.rows[0];

        // Check if user is a member of the group
        const memberCheck = await query(
            'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
            [file.group_id, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to download this file'
            });
        }

        // Send file
        res.download(file.file_path, file.file_name);

    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download file',
            error: error.message
        });
    }
};

module.exports = {
    upload,
    uploadFile,
    getGroupFiles,
    downloadFile
};