
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiX, FiGlobe, FiLock, FiCheck } from 'react-icons/fi';
import './Modal.css';

const CreateGroupModal = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        group_name: '',
        description: '',
        group_type: 'public',
        allowed_college: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/groups/create', formData);
            if (response.data.success) {
                toast.success('Group created successfully! 🎉');
                onSuccess();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Group</h2>
                    <button className="modal-close" onClick={onClose}>
                        <FiX size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Group Name *</label>
                        <input
                            type="text"
                            name="group_name"
                            value={formData.group_name}
                            onChange={handleChange}
                            className="form-input"
                            placeholder="e.g., Placements Discussion"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="form-input"
                            rows="3"
                            placeholder="Brief description of the group..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Group Type *</label>
                        <div className="radio-group">
                            <label className={`radio-card ${formData.group_type === 'public' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="group_type"
                                    value="public"
                                    checked={formData.group_type === 'public'}
                                    onChange={handleChange}
                                />
                                <div className="radio-content">
                                    <FiGlobe size={24} />
                                    <div>
                                        <h4>Public Group</h4>
                                        <p>Any student can join</p>
                                    </div>
                                    {formData.group_type === 'public' && <FiCheck size={20} className="check-icon" />}
                                </div>
                            </label>

                            <label className={`radio-card ${formData.group_type === 'private' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="group_type"
                                    value="private"
                                    checked={formData.group_type === 'private'}
                                    onChange={handleChange}
                                />
                                <div className="radio-content">
                                    <FiLock size={24} />
                                    <div>
                                        <h4>Private Group</h4>
                                        <p>College-restricted access</p>
                                    </div>
                                    {formData.group_type === 'private' && <FiCheck size={20} className="check-icon" />}
                                </div>
                            </label>
                        </div>
                    </div>

                    {formData.group_type === 'private' && (
                        <div className="form-group">
                            <label className="form-label">College Restriction</label>
                            <div className="college-options">
                                <div className="college-option selected">
                                    <strong>Your College:</strong> {user?.college_name}
                                    <span className="badge badge-success">Default</span>
                                </div>
                                <div className="divider">OR</div>
                                <input
                                    type="text"
                                    name="allowed_college"
                                    value={formData.allowed_college}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Enter another college name (optional)"
                                />
                                <p className="help-text">
                                    Leave empty to restrict to your college. Enter a different college name to collaborate with that college only.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Creating...
                                </>
                            ) : (
                                'Create Group'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
