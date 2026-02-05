
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const initializeSocket = (userData) => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            socket.emit('user_connect', userData);
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        console.warn('Socket not initialized. Call initializeSocket first.');
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default { initializeSocket, getSocket, disconnectSocket };