
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
    FiPlus, FiLogOut, FiUsers, FiGlobe, FiLock,
    FiMessageSquare, FiUserPlus
} from 'react-icons/fi';
import CreateGroupModal from '../components/CreateGroupModal';
import JoinGroupModal from '../components/JoinGroupModal';
import './Dashboard.css';

const Dashboard = () => {
    const [groups, setGroups] = useState([]);
    const [myGroups, setMyGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [activeTab, setActiveTab] = useState('my-groups');
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchGroups();
        fetchMyGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await api.get('/groups/all');
            if (response.data.success) {
                setGroups(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const fetchMyGroups = async () => {
        try {
            const response = await api.get('/groups/my-groups');
            if (response.data.success) {
                setMyGroups(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching my groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinGroup = async (groupId) => {
        try {
            const response = await api.post(`/groups/${groupId}/join`);
            if (response.data.success) {
                toast.success('Successfully joined the group!');
                fetchMyGroups();
                fetchGroups();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to join group');
        }
    };

    const handleOpenChat = (groupId) => {
        navigate(`/chat/${groupId}`);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
        toast.info('Logged out successfully');
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="dashboard-header-content">
                    <div>
                        <h1>Student Groups</h1>
                        <p>Welcome back, {user?.name}! 👋</p>
                    </div>
                    <div className="dashboard-header-actions">
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <FiPlus size={18} />
                            Create Group
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowJoinModal(true)}
                        >
                            <FiUserPlus size={18} />
                            Join via Invite
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleLogout}
                        >
                            <FiLogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="dashboard-content">
                <div className="dashboard-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'my-groups' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my-groups')}
                    >
                        <FiMessageSquare size={18} />
                        My Groups ({myGroups.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
                        onClick={() => setActiveTab('discover')}
                    >
                        <FiGlobe size={18} />
                        Discover Groups ({groups.filter(g => !g.is_member).length})
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner-lg"></div>
                        <p>Loading groups...</p>
                    </div>
                ) : (
                    <div className="groups-grid">
                        {activeTab === 'my-groups' ? (
                            myGroups.length > 0 ? (
                                myGroups.map(group => (
                                    <GroupCard
                                        key={group.id}
                                        group={group}
                                        onOpenChat={handleOpenChat}
                                        isMember={true}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">
                                    <FiUsers size={48} />
                                    <h3>No groups yet</h3>
                                    <p>Create a group or join one to get started!</p>
                                </div>
                            )
                        ) : (
                            groups.filter(g => !g.is_member).length > 0 ? (
                                groups.filter(g => !g.is_member).map(group => (
                                    <GroupCard
                                        key={group.id}
                                        group={group}
                                        onJoin={handleJoinGroup}
                                        isMember={false}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">
                                    <FiGlobe size={48} />
                                    <h3>All caught up!</h3>
                                    <p>You're a member of all available groups</p>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreateGroupModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        fetchMyGroups();
                        fetchGroups();
                        setShowCreateModal(false);
                    }}
                />
            )}

            {showJoinModal && (
                <JoinGroupModal
                    onClose={() => setShowJoinModal(false)}
                    onSuccess={() => {
                        fetchMyGroups();
                        fetchGroups();
                        setShowJoinModal(false);
                    }}
                />
            )}
        </div>
    );
};

const GroupCard = ({ group, onOpenChat, onJoin, isMember }) => {
    return (
        <div className="group-card fade-in">
            <div className="group-card-header">
                <div className="group-icon">
                    {group.group_name.charAt(0).toUpperCase()}
                </div>
                <div className="group-info">
                    <h3>{group.group_name}</h3>
                    <p className="text-secondary">{group.description || 'No description'}</p>
                </div>
            </div>

            <div className="group-card-meta">
                <span className={`badge ${group.group_type === 'public' ? 'badge-success' : 'badge-primary'}`}>
                    {group.group_type === 'public' ? <FiGlobe size={12} /> : <FiLock size={12} />}
                    {group.group_type === 'public' ? 'Public' : 'Private'}
                </span>
                {group.allowed_college && (
                    <span className="badge badge-warning">
                        {group.allowed_college}
                    </span>
                )}
            </div>

            <div className="group-card-stats">
                <div className="stat">
                    <FiUsers size={16} />
                    <span>{group.member_count || 0} members</span>
                </div>
            </div>

            <div className="group-card-actions">
                {isMember ? (
                    <button
                        className="btn btn-primary w-full"
                        onClick={() => onOpenChat(group.id)}
                    >
                        <FiMessageSquare size={16} />
                        Open Chat
                    </button>
                ) : (
                    <button
                        className="btn btn-secondary w-full"
                        onClick={() => onJoin(group.id)}
                    >
                        <FiUserPlus size={16} />
                        Join Group
                    </button>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
