// file: frontend/src/components/CallNotification.jsx
import React, { useEffect, useState, useRef } from 'react';
import { FiPhone, FiVideo, FiX, FiCheck } from 'react-icons/fi';
import './CallNotification.css';

const CallNotification = ({ call, onAccept, onDecline }) => {
    const [isVisible, setIsVisible] = useState(false);
    const audioContextRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);

    useEffect(() => {
        // Slide in animation
        setTimeout(() => setIsVisible(true), 100);

        // Play ringtone
        playRingtone();

        return () => {
            // Cleanup on unmount
            stopRingtone();
        };
    }, []);

    const playRingtone = () => {
        try {
            // Create audio context only once
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

            const playBeep = () => {
                if (!audioContextRef.current) return;

                const oscillator = audioContextRef.current.createOscillator();
                const gainNode = audioContextRef.current.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContextRef.current.destination);

                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;

                oscillator.start();
                setTimeout(() => {
                    try {
                        oscillator.stop();
                    } catch (e) {
                        // Ignore if already stopped
                    }
                }, 300);
            };

            // Play first beep
            playBeep();

            // Repeat every 2 seconds
            ringtoneIntervalRef.current = setInterval(playBeep, 2000);

        } catch (error) {
            console.error('Ringtone error:', error);
        }
    };

    const stopRingtone = () => {
        // Clear interval
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }

        // Close audio context properly
        if (audioContextRef.current) {
            try {
                if (audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close();
                }
            } catch (error) {
                console.error('Error closing AudioContext:', error);
            }
            audioContextRef.current = null;
        }
    };

    const handleAccept = () => {
        stopRingtone();
        setIsVisible(false);
        setTimeout(() => onAccept(), 300);
    };

    const handleDecline = () => {
        stopRingtone();
        setIsVisible(false);
        setTimeout(() => onDecline(), 300);
    };

    return (
        <div className={`call-notification ${isVisible ? 'visible' : ''}`}>
            <div className="call-notification-content">
                <div className="call-notification-header">
                    <div className="call-type-icon">
                        {call.callType === 'video' ? (
                            <FiVideo size={24} />
                        ) : (
                            <FiPhone size={24} />
                        )}
                    </div>
                    <div className="call-notification-info">
                        <h4>Incoming {call.callType} call</h4>
                        <p className="caller-name">{call.callerName}</p>
                        <p className="group-name">{call.groupName}</p>
                    </div>
                </div>

                <div className="call-notification-actions">
                    <button
                        className="call-action-btn decline"
                        onClick={handleDecline}
                        title="Decline"
                    >
                        <FiX size={24} />
                    </button>
                    <button
                        className="call-action-btn accept"
                        onClick={handleAccept}
                        title="Accept"
                    >
                        <FiCheck size={24} />
                    </button>
                </div>
            </div>

            <div className="call-notification-pulse"></div>
        </div>
    );
};

export default CallNotification;