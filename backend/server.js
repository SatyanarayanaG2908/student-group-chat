//file: backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, query } = require('./config/database');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const fileRoutes = require('./routes/fileRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Socket.io connection handling
const activeUsers = new Map();
const groupRooms = new Map();
const activeCalls = new Map(); // Track active calls
const callParticipants = new Map(); // Track participants in each call

io.on('connection', (socket) => {
    console.log('✅ New socket connection:', socket.id);

    socket.on('user_connect', (userData) => {
        activeUsers.set(socket.id, {
            userId: userData.userId,
            name: userData.name,
            email: userData.email,
            college: userData.college
        });
        console.log(`User connected: ${userData.name} (${socket.id})`);
    });

    socket.on('join_group', async (data) => {
        try {
            const { groupId, userId } = data;

            const memberCheck = await query(
                'SELECT * FROM group_members WHERE group_id = $1 AND student_id = $2',
                [groupId, userId]
            );

            if (memberCheck.rows.length === 0) {
                socket.emit('error', { message: 'You are not a member of this group' });
                return;
            }

            socket.join(`group_${groupId}`);

            if (!groupRooms.has(groupId)) {
                groupRooms.set(groupId, new Set());
            }
            groupRooms.get(groupId).add(socket.id);

            console.log(`User ${userId} joined group ${groupId}`);

            socket.to(`group_${groupId}`).emit('user_joined', {
                userId: activeUsers.get(socket.id)?.userId,
                name: activeUsers.get(socket.id)?.name
            });

        } catch (error) {
            console.error('Join group error:', error);
            socket.emit('error', { message: 'Failed to join group' });
        }
    });

    socket.on('leave_group', (data) => {
        const { groupId } = data;
        socket.leave(`group_${groupId}`);

        if (groupRooms.has(groupId)) {
            groupRooms.get(groupId).delete(socket.id);
        }

        console.log(`User left group ${groupId}`);

        socket.to(`group_${groupId}`).emit('user_left', {
            userId: activeUsers.get(socket.id)?.userId,
            name: activeUsers.get(socket.id)?.name
        });
    });

    socket.on('send_message', async (data) => {
        try {
            const { groupId, senderId, messageText } = data;

            const result = await query(
                'INSERT INTO messages (group_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING *',
                [groupId, senderId, messageText]
            );

            const senderResult = await query(
                'SELECT name, college_name FROM students WHERE id = $1',
                [senderId]
            );

            const message = {
                ...result.rows[0],
                sender_name: senderResult.rows[0].name,
                sender_college: senderResult.rows[0].college_name
            };

            io.to(`group_${groupId}`).emit('new_message', message);

        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('typing', (data) => {
        const { groupId, userName } = data;
        socket.to(`group_${groupId}`).emit('user_typing', { userName });
    });

    socket.on('stop_typing', (data) => {
        const { groupId } = data;
        socket.to(`group_${groupId}`).emit('user_stop_typing');
    });

    socket.on('delete_messages', ({ groupId, messageIds }) => {
        console.log(`🗑️ Deleting ${messageIds.length} messages from group ${groupId}`);
        io.to(`group_${groupId}`).emit('messages_deleted', { messageIds });
    });

    // ========================================================================
    // CALL MANAGEMENT (UPDATED)
    // ========================================================================

    socket.on('start-call', ({ groupId, callId, callType, callerName, callerId, groupName }) => {
        console.log(`📞 Call started in group ${groupId} by ${callerName}`);

        // Store active call
        activeCalls.set(callId, {
            groupId,
            callType,
            callerName,
            callerId,
            groupName,
            startTime: Date.now(),
            participants: new Set([callerId])
        });

        // Initialize participants map for this call
        callParticipants.set(callId, new Map([[callerId, { name: callerName, joinTime: Date.now() }]]));

        // Notify all members in the group (including caller)
        io.to(`group_${groupId}`).emit('call-started', {
            callId,
            callType,
            callerName,
            callerId,
            groupName
        });
    });

    socket.on('user-joined-call', ({ groupId, callId, userName, userId }) => {
        console.log(`📞 ${userName} joined call ${callId}`);

        // Add to participants
        if (callParticipants.has(callId)) {
            callParticipants.get(callId).set(userId, { name: userName, joinTime: Date.now() });
        }

        // Notify all group members
        io.to(`group_${groupId}`).emit('user-joined-call', {
            callId,
            userName,
            userId
        });
    });

    socket.on('end-call', ({ groupId, callId, callerName, duration }) => {
        console.log(`📞 Call ended: ${callId}`);

        // Calculate total duration if not provided
        const call = activeCalls.get(callId);
        let callDuration = duration;

        if (!callDuration && call) {
            callDuration = Math.floor((Date.now() - call.startTime) / 1000);
        }

        // Remove call from active calls
        activeCalls.delete(callId);
        callParticipants.delete(callId);

        // Notify all members
        io.to(`group_${groupId}`).emit('call-ended', {
            callId,
            callerName,
            duration: callDuration
        });
    });

    // ========================================================================
    // WEBRTC SIGNALING HANDLERS
    // ========================================================================

    socket.on('webrtc-join-call', ({ groupId, userId, userName }) => {
        console.log(`📞 ${userName} joining WebRTC call in group ${groupId}`);

        // Join the call room
        socket.join(`call_${groupId}`);

        // Notify all other users in the call
        socket.to(`call_${groupId}`).emit('webrtc-user-joined', {
            userId,
            userName
        });
    });

    socket.on('webrtc-offer', ({ groupId, targetUserId, offer, fromUserId, fromUserName }) => {
        console.log(`📤 Forwarding offer from ${fromUserName} to ${targetUserId}`);

        // Find the target socket
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => activeUsers.get(s.id)?.userId === targetUserId);

        if (targetSocket) {
            targetSocket.emit('webrtc-offer', {
                fromUserId,
                fromUserName,
                offer
            });
        } else {
            console.warn(`Target user ${targetUserId} not found`);
        }
    });

    socket.on('webrtc-answer', ({ groupId, targetUserId, answer, fromUserId }) => {
        console.log(`📥 Forwarding answer from ${fromUserId} to ${targetUserId}`);

        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => activeUsers.get(s.id)?.userId === targetUserId);

        if (targetSocket) {
            targetSocket.emit('webrtc-answer', {
                fromUserId,
                answer
            });
        }
    });

    socket.on('webrtc-ice-candidate', ({ groupId, targetUserId, candidate, fromUserId }) => {
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => activeUsers.get(s.id)?.userId === targetUserId);

        if (targetSocket) {
            targetSocket.emit('webrtc-ice-candidate', {
                fromUserId,
                candidate
            });
        }
    });

    socket.on('webrtc-leave-call', ({ groupId, userId, userName }) => {
        console.log(`📞 ${userName} left WebRTC call`);

        // Calculate duration for this participant
        let duration = 0;
        for (const [callId, participants] of callParticipants.entries()) {
            if (participants.has(userId)) {
                const joinTime = participants.get(userId).joinTime;
                duration = Math.floor((Date.now() - joinTime) / 1000);
                participants.delete(userId);
                break;
            }
        }

        // Leave the call room
        socket.leave(`call_${groupId}`);

        // Notify others in the call
        socket.to(`call_${groupId}`).emit('webrtc-user-left', {
            userId,
            userName
        });

        // Notify all group members
        io.to(`group_${groupId}`).emit('user-left-call', {
            userId,
            userName,
            duration
        });
    });

    // ========================================================================
    // DISCONNECT HANDLER
    // ========================================================================

    socket.on('disconnect', () => {
        const userData = activeUsers.get(socket.id);

        // Calculate duration for any active calls this user was in
        if (userData) {
            for (const [callId, participants] of callParticipants.entries()) {
                if (participants.has(userData.userId)) {
                    const joinTime = participants.get(userData.userId).joinTime;
                    const duration = Math.floor((Date.now() - joinTime) / 1000);

                    const call = activeCalls.get(callId);
                    if (call) {
                        io.to(`group_${call.groupId}`).emit('user-left-call', {
                            userId: userData.userId,
                            userName: userData.name,
                            duration
                        });
                    }

                    participants.delete(userData.userId);
                }
            }
        }

        // Remove from all group rooms
        groupRooms.forEach((sockets, groupId) => {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                io.to(`group_${groupId}`).emit('user_disconnected', {
                    userId: userData?.userId,
                    name: userData?.name
                });

                // If user was in a call, notify others
                socket.to(`call_${groupId}`).emit('webrtc-user-left', {
                    userId: userData?.userId,
                    userName: userData?.name
                });
            }
        });

        activeUsers.delete(socket.id);
        console.log('❌ Socket disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════╗
    ║   🚀 Student Group Chat Server Running       ║
    ║   📡 Port: ${PORT}                           ║
    ║   🌐 Environment: ${process.env.NODE_ENV || 'development'}║
    ║   📁 Upload Directory: uploads               ║
    ║   📞 WebRTC Calls: Enabled                   ║
    ╚══════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });
});

module.exports = { app, io };