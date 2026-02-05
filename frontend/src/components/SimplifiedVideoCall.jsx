// file: frontend/src/components/SimplifiedVideoCall.jsx
import React, { useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { FiMic, FiMicOff, FiCamera, FiCameraOff, FiPhoneOff, FiMonitor } from 'react-icons/fi';

const SimplifiedVideoCall = ({ groupId, userId, userName, onEndCall }) => {
    const {
        localStream,
        remoteStreams,
        callDuration,
        isMuted,
        isCameraOff,
        toggleMute,
        toggleCamera,
        endCall
    } = useWebRTC(groupId, userId, userName, 'video');

    const localVideoRef = useRef();

    // Attach local stream to video element
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        endCall();
        onEndCall(callDuration); // Pass duration to parent
    };

    return (
        <div className="modal-overlay call-overlay">
            <div className="call-interface video-call">
                <div className="call-header">
                    <h3>Group Video Call</h3>
                    <p>{remoteStreams.size + 1} participants</p>
                </div>

                <div className="video-grid">
                    {/* Local User Video */}
                    <div className="video-participant">
                        <div className="participant-video">
                            {isCameraOff ? (
                                <>
                                    <div className="participant-avatar-large">
                                        {userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="camera-off-overlay">
                                        <FiCameraOff size={32} />
                                        <p>Camera is off</p>
                                    </div>
                                </>
                            ) : (
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            <span className="participant-name-overlay">{userName} (You)</span>
                        </div>
                    </div>

                    {/* Remote Users Video */}
                    {Array.from(remoteStreams.entries()).map(([remoteUserId, { stream, name }]) => (
                        <RemoteVideoParticipant
                            key={remoteUserId}
                            stream={stream}
                            name={name}
                        />
                    ))}
                </div>

                <div className="call-duration">
                    <span>{formatDuration(callDuration)}</span>
                </div>

                <div className="call-controls">
                    <button
                        className={`call-btn ${isMuted ? 'active' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Mic" : "Mute Mic"}
                    >
                        {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
                    </button>

                    <button
                        className={`call-btn ${isCameraOff ? 'active' : ''}`}
                        onClick={toggleCamera}
                        title={isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
                    >
                        {isCameraOff ? <FiCameraOff size={24} /> : <FiCamera size={24} />}
                    </button>

                    <button
                        className="call-btn end-call"
                        onClick={handleEndCall}
                        title="End Call"
                    >
                        <FiPhoneOff size={28} />
                    </button>

                    <button className="call-btn" title="Share Screen">
                        <FiMonitor size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const RemoteVideoParticipant = ({ stream, name }) => {
    const videoRef = useRef();

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const hasVideo = stream?.getVideoTracks().length > 0;

    return (
        <div className="video-participant">
            <div className="participant-video">
                {hasVideo ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <>
                        <div className="participant-avatar-large">
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="camera-off-overlay">
                            <FiCameraOff size={32} />
                            <p>Camera is off</p>
                        </div>
                    </>
                )}
                <span className="participant-name-overlay">{name}</span>
            </div>
        </div>
    );
};

export default SimplifiedVideoCall;