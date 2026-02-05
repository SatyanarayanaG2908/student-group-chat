//file: backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');

// Student Registration
const register = async (req, res) => {
    try {
        const { name, email, password, college_name } = req.body;

        // Validation
        if (!name || !email || !password || !college_name) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if email already exists
        const existingUser = await query(
            'SELECT * FROM students WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new student
        const result = await query(
            'INSERT INTO students (name, email, password, college_name) VALUES ($1, $2, $3, $4) RETURNING id, name, email, college_name, created_at',
            [name, email, hashedPassword, college_name]
        );

        const newStudent = result.rows[0];

        // Generate token
        const token = generateToken(newStudent);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: newStudent.id,
                    name: newStudent.name,
                    email: newStudent.email,
                    college_name: newStudent.college_name
                },
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

// Student Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check if user exists
        const result = await query(
            'SELECT * FROM students WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const student = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, student.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(student);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: student.id,
                    name: student.name,
                    email: student.email,
                    college_name: student.college_name
                },
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(
            'SELECT id, name, email, college_name, created_at FROM students WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    getProfile
};