// file: frontend/src/components/SimplifiedAudioCall.jsx
import React, { useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { FiMic, FiMicOff, FiPhoneOff, FiVolume2 } from 'react-icons/fi';

const SimplifiedAudioCall = ({ groupId, userId, userName, onEndCall }) => {
    const {
        localStream,
        remoteStreams,
        callDuration,
        isMuted,
        toggleMute,
        endCall
    } = useWebRTC(groupId, userId, userName, 'audio');

    const localAudioRef = useRef();

    // Attach local stream to audio element (muted to prevent echo)
    useEffect(() => {
        if (localStream && localAudioRef.current) {
            localAudioRef.current.srcObject = localStream;
            localAudioRef.current.muted = true; // Prevent hearing yourself
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
            <div className="call-interface audio-call">
                <div className="call-header">
                    <h3>Group Audio Call</h3>
                    <p>{remoteStreams.size + 1} participants</p>
                </div>

                <div className="call-participants">
                    {/* Local User */}
                    <div className="call-participant">
                        <div className="participant-avatar">
                            {userName.charAt(0).toUpperCase()}
                            {!isMuted && (
                                <div className="audio-wave">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            )}
                        </div>
                        <span className="participant-name">{userName} (You)</span>
                    </div>

                    {/* Remote Users */}
                    {Array.from(remoteStreams.entries()).map(([remoteUserId, { stream, name }]) => (
                        <RemoteAudioParticipant
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
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
                    </button>

                    <button
                        className="call-btn end-call"
                        onClick={handleEndCall}
                        title="End Call"
                    >
                        <FiPhoneOff size={28} />
                    </button>

                    <button className="call-btn" title="Speaker">
                        <FiVolume2 size={24} />
                    </button>
                </div>

                {/* Hidden audio element for local stream */}
                <audio ref={localAudioRef} autoPlay muted />
            </div>
        </div>
    );
};

const RemoteAudioParticipant = ({ stream, name }) => {
    const audioRef = useRef();

    useEffect(() => {
        if (stream && audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(err => {
                console.error('Audio play error:', err);
            });
        }
    }, [stream]);

    return (
        <div className="call-participant">
            <div className="participant-avatar">
                {name.charAt(0).toUpperCase()}
                <div className="audio-wave">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <span className="participant-name">{name}</span>
            <audio ref={audioRef} autoPlay />
        </div>
    );
};

export default SimplifiedAudioCall;