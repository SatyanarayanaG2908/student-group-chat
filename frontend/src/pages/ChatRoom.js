// file: frontend/src/pages/ChatRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
    FiArrowLeft, FiUsers, FiSend, FiPaperclip, FiSmile,
    FiPhone, FiVideo, FiMoreVertical, FiDownload, FiX,
    FiShare2, FiTrash2, FiCheckCircle
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import SimplifiedAudioCall from '../components/SimplifiedAudioCall';
import SimplifiedVideoCall from '../components/SimplifiedVideoCall';
import CallNotification from '../components/CallNotification';
import './ChatRoom.css';

const ChatRoom = () => {
    const { group_id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const socket = getSocket();
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // State management
    const [group, setGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [typing, setTyping] = useState(false);
    const [typingUser, setTypingUser] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAudioCall, setShowAudioCall] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Call notification state
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCallId, setActiveCallId] = useState(null);

    // Message selection for delete
    const [selectedMessages, setSelectedMessages] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
        fetchMessages();
        fetchMembers();

        if (socket) {
            socket.emit('join_group', {
                groupId: group_id,
                userId: user.id
            });

            socket.on('new_message', (message) => {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            });

            socket.on('user_typing', ({ userName }) => {
                setTyping(true);
                setTypingUser(userName);
            });

            socket.on('user_stop_typing', () => {
                setTyping(false);
                setTypingUser('');
            });

            socket.on('user_joined', ({ name }) => {
                toast.info(`${name} joined the group`);
                fetchMembers();
            });

            socket.on('user_left', ({ name }) => {
                toast.info(`${name} left the group`);
                fetchMembers();
            });

            socket.on('messages_deleted', ({ messageIds }) => {
                setMessages(prev => prev.filter(msg => !messageIds.includes(msg.id)));
            });

            // CALL NOTIFICATION LISTENERS
            socket.on('call-started', ({ callId, callType, callerName, callerId, groupName }) => {
                // Add system message to chat
                const systemMessage = {
                    id: `system_${Date.now()}`,
                    message_text: JSON.stringify({
                        type: 'system',
                        message: `${callerName} started a ${callType} call`
                    }),
                    created_at: new Date().toISOString(),
                    sender_id: callerId
                };
                setMessages(prev => [...prev, systemMessage]);

                // Don't show notification to the caller
                if (callerId !== user.id) {
                    setIncomingCall({
                        callId,
                        callType,
                        callerName,
                        callerId,
                        groupName: groupName || group?.group_name
                    });
                } else {
                    // Caller automatically joins
                    setActiveCallId(callId);
                }
            });

            socket.on('call-ended', ({ callId, callerName, duration }) => {
                // Add system message to chat
                const systemMessage = {
                    id: `system_${Date.now()}`,
                    message_text: JSON.stringify({
                        type: 'system',
                        message: `Call ended (Duration: ${formatDuration(duration || 0)})`
                    }),
                    created_at: new Date().toISOString(),
                    sender_id: user.id
                };
                setMessages(prev => [...prev, systemMessage]);

                if (activeCallId === callId) {
                    setActiveCallId(null);
                    setShowAudioCall(false);
                    setShowVideoCall(false);
                    toast.info('Call ended');
                }
                setIncomingCall(null);
            });

            // User joined call notification
            socket.on('user-joined-call', ({ userName }) => {
                const systemMessage = {
                    id: `system_${Date.now()}`,
                    message_text: JSON.stringify({
                        type: 'system',
                        message: `${userName} joined the call`
                    }),
                    created_at: new Date().toISOString(),
                    sender_id: user.id
                };
                setMessages(prev => [...prev, systemMessage]);
            });

            // User left call notification
            socket.on('user-left-call', ({ userName, duration }) => {
                const systemMessage = {
                    id: `system_${Date.now()}`,
                    message_text: JSON.stringify({
                        type: 'system',
                        message: `${userName} left the call (Duration: ${formatDuration(duration || 0)})`
                    }),
                    created_at: new Date().toISOString(),
                    sender_id: user.id
                };
                setMessages(prev => [...prev, systemMessage]);
            });
        }

        return () => {
            if (socket) {
                socket.emit('leave_group', { groupId: group_id });
                socket.off('new_message');
                socket.off('user_typing');
                socket.off('user_stop_typing');
                socket.off('user_joined');
                socket.off('user_left');
                socket.off('messages_deleted');
                socket.off('call-started');
                socket.off('call-ended');
                socket.off('user-joined-call');
                socket.off('user-left-call');
            }
        };
    }, [group_id, socket, user.id]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const fetchGroupDetails = async () => {
        try {
            const response = await api.get(`/groups/all`);
            const groupData = response.data.data.find(g => g.id === parseInt(group_id));
            if (groupData) {
                setGroup(groupData);
                setIsAdmin(groupData.created_by === user.id);
            }
        } catch (error) {
            console.error('Error fetching group:', error);
            toast.error('Failed to load group details');
        }
    };

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/messages/${group_id}`);
            if (response.data.success) {
                setMessages(response.data.data);
                scrollToBottom();
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const response = await api.get(`/groups/${group_id}/members`);
            if (response.data.success) {
                setMembers(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageText.trim()) return;

        setMessageText('');
        setShowEmojiPicker(false);

        if (socket) {
            socket.emit('send_message', {
                groupId: group_id,
                senderId: user.id,
                messageText: messageText
            });
        }
    };

    const handleTyping = (e) => {
        setMessageText(e.target.value);

        if (socket && e.target.value) {
            socket.emit('typing', {
                groupId: group_id,
                userName: user.name
            });
        }

        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            if (socket) {
                socket.emit('stop_typing', { groupId: group_id });
            }
        }, 2000);
    };

    const handleEmojiClick = (emojiObject) => {
        setMessageText(prev => prev + emojiObject.emoji);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Increased file size limit to 100MB and removed file type restrictions
        if (file.size > 100 * 1024 * 1024) {
            toast.error('File size must be less than 100MB');
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('group_id', group_id);

            const response = await api.post('/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 120000 // 2 minute timeout for large files
            });

            if (response.data.success) {
                const fileData = response.data.data;
                toast.success('File uploaded successfully!');

                const fileMessage = JSON.stringify({
                    type: 'file',
                    fileName: file.name,
                    fileId: fileData.id,
                    fileType: file.type || 'application/octet-stream',
                    fileSize: file.size
                });

                if (socket) {
                    socket.emit('send_message', {
                        groupId: group_id,
                        senderId: user.id,
                        messageText: fileMessage
                    });
                }
            }
        } catch (error) {
            console.error('File upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleShareInviteCode = () => {
        setShowInviteModal(true);
        setShowOptionsMenu(false);
    };

    const handleCopyInviteCode = () => {
        if (group?.invite_code) {
            navigator.clipboard.writeText(group.invite_code);
            toast.success('Invite code copied to clipboard!');
            setShowInviteModal(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!window.confirm('Are you sure you want to delete this group?')) return;

        try {
            const response = await api.delete(`/groups/${group_id}`);
            if (response.data.success) {
                toast.success('Group deleted successfully');
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error('Failed to delete group');
        }
    };

    const handleStartCall = (type) => {
        const callId = `call_${group_id}_${Date.now()}`;
        setActiveCallId(callId);

        // Notify all group members about the call
        if (socket) {
            socket.emit('start-call', {
                groupId: group_id,
                callId,
                callType: type,
                callerName: user.name,
                callerId: user.id,
                groupName: group?.group_name
            });
        }

        // Open call interface for caller
        if (type === 'audio') {
            setShowAudioCall(true);
        } else {
            setShowVideoCall(true);
        }
    };

    const handleEndCall = (duration) => {
        if (socket && activeCallId) {
            socket.emit('end-call', {
                groupId: group_id,
                callId: activeCallId,
                callerName: user.name,
                duration: duration || 0
            });
        }

        setShowAudioCall(false);
        setShowVideoCall(false);
        setActiveCallId(null);
    };

    const handleAcceptCall = () => {
        if (!incomingCall) return;

        setActiveCallId(incomingCall.callId);

        // Emit user joined call event
        if (socket) {
            socket.emit('user-joined-call', {
                groupId: group_id,
                callId: incomingCall.callId,
                userName: user.name,
                userId: user.id
            });
        }

        if (incomingCall.callType === 'audio') {
            setShowAudioCall(true);
        } else {
            setShowVideoCall(true);
        }

        setIncomingCall(null);
    };

    const handleDeclineCall = () => {
        setIncomingCall(null);
        toast.info('Call declined');
    };

    const handleLongPress = (messageId) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedMessages([messageId]);
        }
    };

    const handleSelectMessage = (messageId) => {
        if (selectionMode) {
            setSelectedMessages(prev => {
                if (prev.includes(messageId)) {
                    return prev.filter(id => id !== messageId);
                } else {
                    return [...prev, messageId];
                }
            });
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedMessages.length === 0) return;

        const confirmText = selectedMessages.length === 1
            ? 'Delete this message for everyone?'
            : `Delete ${selectedMessages.length} messages for everyone?`;

        if (!window.confirm(confirmText)) return;

        try {
            await api.post('/messages/delete', {
                messageIds: selectedMessages,
                groupId: group_id
            });

            if (socket) {
                socket.emit('delete_messages', {
                    groupId: group_id,
                    messageIds: selectedMessages
                });
            }

            setMessages(prev => prev.filter(msg => !selectedMessages.includes(msg.id)));
            toast.success(`${selectedMessages.length} message(s) deleted`);

            setSelectionMode(false);
            setSelectedMessages([]);
        } catch (error) {
            toast.error('Failed to delete messages');
        }
    };

    const handleCancelSelection = () => {
        setSelectionMode(false);
        setSelectedMessages([]);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    const handleDownloadFile = async (fileId, fileName) => {
        try {
            const response = await api.get(`/files/download/${fileId}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('File downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download file');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        else return (bytes / 1073741824).toFixed(1) + ' GB';
    };

    const getFileIcon = (fileName, fileType) => {
        const ext = fileName.split('.').pop().toLowerCase();

        if (fileType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
            return '🖼️';
        }
        if (fileType?.includes('pdf') || ext === 'pdf') {
            return '📄';
        }
        if (ext === 'doc' || ext === 'docx' || fileType?.includes('word')) {
            return '📝';
        }
        if (ext === 'ppt' || ext === 'pptx' || fileType?.includes('presentation')) {
            return '📊';
        }
        if (ext === 'xls' || ext === 'xlsx' || fileType?.includes('spreadsheet')) {
            return '📈';
        }
        if (fileType?.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
            return '🎥';
        }
        if (fileType?.includes('audio') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) {
            return '🎵';
        }
        if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
            return '📦';
        }
        if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'sql'].includes(ext)) {
            return '💻';
        }
        if (ext === 'txt' || fileType?.includes('text')) {
            return '📃';
        }

        return '📎';
    };

    const isFileMessage = (messageText) => {
        try {
            const parsed = JSON.parse(messageText);
            return parsed.type === 'file';
        } catch {
            return false;
        }
    };

    const isSystemMessage = (messageText) => {
        try {
            const parsed = JSON.parse(messageText);
            return parsed.type === 'system';
        } catch {
            return false;
        }
    };

    const parseMessage = (messageText) => {
        try {
            return JSON.parse(messageText);
        } catch {
            return null;
        }
    };

    if (loading) {
        return (
            <div className="chat-loading">
                <div className="spinner-lg"></div>
                <p>Loading chat...</p>
            </div>
        );
    }

    return (
        <div className="chat-room">
            {/* Call Notification - Floating on top */}
            {incomingCall && !showAudioCall && !showVideoCall && (
                <CallNotification
                    call={incomingCall}
                    onAccept={handleAcceptCall}
                    onDecline={handleDeclineCall}
                />
            )}

            {selectionMode && (
                <div className="selection-header">
                    <button className="icon-btn" onClick={handleCancelSelection}>
                        <FiX size={24} />
                    </button>
                    <span>{selectedMessages.length} selected</span>
                    <button className="icon-btn danger" onClick={handleDeleteSelected}>
                        <FiTrash2 size={20} />
                    </button>
                </div>
            )}

            {!selectionMode && (
                <header className="chat-header">
                    <div className="chat-header-left">
                        <button
                            className="back-btn"
                            onClick={() => navigate('/dashboard')}
                        >
                            <FiArrowLeft size={24} />
                        </button>
                        <div className="chat-header-info">
                            <div className="group-avatar">
                                {group?.group_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="group-details">
                                <h3>{group?.group_name}</h3>
                                <p onClick={() => setShowMembersModal(true)} className="members-count">
                                    <FiUsers size={14} />
                                    {members.length} members
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="chat-header-actions">
                        <button
                            className="icon-btn"
                            title="Audio Call"
                            onClick={() => handleStartCall('audio')}
                            disabled={!!activeCallId}
                        >
                            <FiPhone size={20} />
                        </button>
                        <button
                            className="icon-btn"
                            title="Video Call"
                            onClick={() => handleStartCall('video')}
                            disabled={!!activeCallId}
                        >
                            <FiVideo size={20} />
                        </button>
                        <button
                            className="icon-btn"
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                        >
                            <FiMoreVertical size={20} />
                        </button>

                        {showOptionsMenu && (
                            <div className="options-menu">
                                <button onClick={handleShareInviteCode}>
                                    <FiShare2 size={16} />
                                    Share Invite Code
                                </button>
                                {isAdmin && (
                                    <button onClick={handleDeleteGroup} className="danger">
                                        <FiTrash2 size={16} />
                                        Delete Group
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </header>
            )}

            <div className="messages-container">
                <div className="messages-list">
                    {messages.length === 0 ? (
                        <div className="empty-chat">
                            <FiUsers size={48} />
                            <h3>No messages yet</h3>
                            <p>Start a conversation with your group!</p>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const isOwnMessage = message.sender_id === user.id;
                            const showDateSeparator = index === 0 ||
                                formatDate(messages[index - 1].created_at) !== formatDate(message.created_at);

                            const isSystem = isSystemMessage(message.message_text);
                            const isFile = isFileMessage(message.message_text);
                            const isSelected = selectedMessages.includes(message.id);

                            if (isSystem) {
                                const systemData = parseMessage(message.message_text);
                                return (
                                    <React.Fragment key={message.id}>
                                        {showDateSeparator && (
                                            <div className="date-separator">
                                                <span>{formatDate(message.created_at)}</span>
                                            </div>
                                        )}
                                        <div className="system-message">
                                            <span>
                                                {systemData.message.includes('call') ? '📞 ' : ''}
                                                {systemData.message}
                                            </span>
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            return (
                                <React.Fragment key={message.id}>
                                    {showDateSeparator && (
                                        <div className="date-separator">
                                            <span>{formatDate(message.created_at)}</span>
                                        </div>
                                    )}
                                    <div
                                        className={`message ${isOwnMessage ? 'own' : 'other'} ${isSelected ? 'selected' : ''}`}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            handleLongPress(message.id);
                                        }}
                                        onClick={() => selectionMode && handleSelectMessage(message.id)}
                                    >
                                        {selectionMode && (
                                            <div className="message-checkbox">
                                                {isSelected ? <FiCheckCircle size={20} /> : <div className="checkbox-empty"></div>}
                                            </div>
                                        )}
                                        {!isOwnMessage && (
                                            <div className="message-avatar">
                                                {message.sender_name?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="message-content">
                                            {!isOwnMessage && (
                                                <div className="message-sender">{message.sender_name}</div>
                                            )}
                                            <div className="message-bubble">
                                                {isFile ? (
                                                    (() => {
                                                        const fileData = parseMessage(message.message_text);
                                                        return (
                                                            <div className="file-message">
                                                                <div className="file-icon">
                                                                    {getFileIcon(fileData.fileName, fileData.fileType)}
                                                                </div>
                                                                <div className="file-details">
                                                                    <div className="file-name">{fileData.fileName}</div>
                                                                    <div className="file-size">{formatFileSize(fileData.fileSize)}</div>
                                                                </div>
                                                                <button
                                                                    className="file-download-btn"
                                                                    onClick={() => handleDownloadFile(fileData.fileId, fileData.fileName)}
                                                                    title="Download file"
                                                                >
                                                                    <FiDownload size={18} />
                                                                </button>
                                                                <span className="message-time">
                                                                    {formatTime(message.created_at)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <>
                                                        <p>{message.message_text}</p>
                                                        <span className="message-time">
                                                            {formatTime(message.created_at)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {typing && (
                    <div className="typing-indicator">
                        <div className="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span className="typing-text">{typingUser} is typing...</span>
                    </div>
                )}
            </div>

            <div className="chat-input-container">
                <form onSubmit={handleSendMessage} className="chat-input-form">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />

                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        title="Attach file (All formats supported, max 100MB)"
                    >
                        {uploading ? (
                            <div className="spinner"></div>
                        ) : (
                            <FiPaperclip size={20} />
                        )}
                    </button>

                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Add emoji"
                    >
                        <FiSmile size={20} />
                    </button>

                    <textarea
                        value={messageText}
                        onChange={handleTyping}
                        placeholder="Type a message..."
                        className="message-input"
                        rows="1"
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                    />

                    <button
                        type="submit"
                        className="send-btn"
                        disabled={!messageText.trim()}
                    >
                        <FiSend size={20} />
                    </button>
                </form>

                {showEmojiPicker && (
                    <div className="emoji-picker-container">
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            width="100%"
                            height="400px"
                        />
                    </div>
                )}
            </div>

            {showMembersModal && (
                <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
                    <div className="modal-content members-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Group Members ({members.length})</h2>
                            <button className="modal-close" onClick={() => setShowMembersModal(false)}>
                                <FiX size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="members-list">
                                {members.map(member => (
                                    <div key={member.id} className="member-item">
                                        <div className="member-avatar">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">
                                                {member.name}
                                                {member.is_admin && (
                                                    <span className="badge badge-primary">Admin</span>
                                                )}
                                            </div>
                                            <div className="member-college">{member.college_name}</div>
                                        </div>
                                        <div className="member-status online">
                                            <span className="status-dot"></span>
                                            Online
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Share Invite Code</h2>
                            <button className="modal-close" onClick={() => setShowInviteModal(false)}>
                                <FiX size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="invite-description">
                                Share this code with others to invite them to the group:
                            </p>
                            <div className="invite-code-display">
                                <code>{group?.invite_code}</code>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowInviteModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCopyInviteCode}
                            >
                                <FiShare2 size={16} />
                                Copy Code
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAudioCall && (
                <SimplifiedAudioCall
                    groupId={group_id}
                    userId={user.id}
                    userName={user.name}
                    onEndCall={handleEndCall}
                />
            )}

            {showVideoCall && (
                <SimplifiedVideoCall
                    groupId={group_id}
                    userId={user.id}
                    userName={user.name}
                    onEndCall={handleEndCall}
                />
            )}
        </div>
    );
};

export default ChatRoom;