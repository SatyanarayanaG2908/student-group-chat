
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiUser, FiMail, FiLock, FiBook, FiUserPlus } from 'react-icons/fi';
import './Auth.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        college_name: ''
    });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match!');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/auth/register', {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                college_name: formData.college_name
            });

            if (response.data.success) {
                login(response.data.data.user, response.data.data.token);
                toast.success('Registration successful! Welcome 🎉');
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card fade-in">
                <div className="auth-header">
                    <div className="auth-icon">
                        <FiUserPlus size={32} />
                    </div>
                    <h1>Create Account</h1>
                    <p>Join the student community today</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">
                            <FiUser size={16} />
                            Full Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Enter your full name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <FiMail size={16} />
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <FiBook size={16} />
                            College Name
                        </label>
                        <input
                            type="text"
                            name="college_name"
                            value={formData.college_name}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="e.g., JNTU Hyderabad"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <FiLock size={16} />
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Create a password (min 6 characters)"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <FiLock size={16} />
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="Confirm your password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner"></div>
                                Creating account...
                            </>
                        ) : (
                            <>
                                <FiUserPlus size={18} />
                                Register
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">
                            Login here
                        </Link>
                    </p>
                </div>
            </div>

            <div className="auth-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>
        </div>
    );
};

export default Register;