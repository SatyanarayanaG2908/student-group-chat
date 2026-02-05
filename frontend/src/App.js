
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import './App.css';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner-lg"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner-lg"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return isAuthenticated ? <Navigate to="/dashboard" /> : children;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            <Route
                path="/register"
                element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/chat/:group_id"
                element={
                    <ProtectedRoute>
                        <ChatRoom />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <div className="app">
                    <AppRoutes />
                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="light"
                    />
                </div>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;