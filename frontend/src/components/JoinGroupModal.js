
import React, { useState } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiX, FiKey } from 'react-icons/fi';
import './Modal.css';

const JoinGroupModal = ({ onClose, onSuccess }) => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/groups/join-invite', { invite_code: inviteCode });
            if (response.data.success) {
                toast.success('Successfully joined the group! 🎉');
                onSuccess();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid invite code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content scale-in" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Join via Invite Code</h2>
                    <button className="modal-close" onClick={onClose}>
                        <FiX size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label className="form-label">
                            <FiKey size={16} />
                            Invite Code
                        </label>
                        <input
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            className="form-input"
                            placeholder="Enter invite code (e.g., PUBLIC-abc123)"
                            required
                            style={{ fontFamily: 'monospace', fontSize: '1rem' }}
                        />
                        <p className="help-text">
                            Ask the group admin for the invite code
                        </p>
                    </div>

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
                            disabled={loading || !inviteCode.trim()}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Joining...
                                </>
                            ) : (
                                'Join Group'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JoinGroupModal;
