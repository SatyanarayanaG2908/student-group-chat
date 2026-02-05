
//file: backend/middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is missing'
            });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            // Add user info to request
            req.user = {
                id: decoded.id,
                email: decoded.email,
                name: decoded.name,
                college_name: decoded.college_name
            };

            next();
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            college_name: user.college_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' } // Token expires in 7 days
    );
};

module.exports = {
    authenticateToken,
    generateToken
};