
import React, { createContext, useState, useContext, useEffect } from 'react';
import { initializeSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is already logged in
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            const userData = JSON.parse(storedUser);
            setUser(userData);

            // Initialize socket connection
            initializeSocket({
                userId: userData.id,
                name: userData.name,
                email: userData.email,
                college: userData.college_name
            });
        }

        setLoading(false);
    }, []);

    const login = (userData, authToken) => {
        setUser(userData);
        setToken(authToken);
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));

        // Initialize socket connection
        initializeSocket({
            userId: userData.id,
            name: userData.name,
            email: userData.email,
            college: userData.college_name
        });
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Disconnect socket
        disconnectSocket();
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};