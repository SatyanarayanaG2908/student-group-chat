// file: frontend/src/hooks/useWebRTC.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

export const useWebRTC = (groupId, userId, userName, callType) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const peerConnections = useRef(new Map());
    const socket = useRef(null);
    const durationInterval = useRef(null);
    const processedOffers = useRef(new Set());
    const isCleaningUp = useRef(false);

    // Initialize media and socket
    useEffect(() => {
        if (isCleaningUp.current) return;

        socket.current = getSocket();
        initializeMedia();

        return () => {
            cleanup();
        };
    }, []);

    // Start duration counter only after initialization
    useEffect(() => {
        if (isInitialized && !durationInterval.current) {
            durationInterval.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }

        return () => {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
                durationInterval.current = null;
            }
        };
    }, [isInitialized]);

    const initializeMedia = async () => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: callType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            setIsInitialized(true);

            // Setup socket listeners BEFORE joining
            setupSocketListeners();

            // Emit join event after getting media
            setTimeout(() => {
                socket.current.emit('webrtc-join-call', {
                    groupId,
                    userId,
                    userName
                });
            }, 100);

        } catch (error) {
            console.error('Media access error:', error);
            alert('Could not access microphone/camera. Please check permissions.');
        }
    };

    const setupSocketListeners = () => {
        // Remove existing listeners to prevent duplicates
        socket.current.off('webrtc-user-joined');
        socket.current.off('webrtc-offer');
        socket.current.off('webrtc-answer');
        socket.current.off('webrtc-ice-candidate');
        socket.current.off('webrtc-user-left');

        // When another user joins the call
        socket.current.on('webrtc-user-joined', async ({ userId: remoteUserId, userName: remoteName }) => {
            if (remoteUserId === userId || isCleaningUp.current) return;

            // Prevent duplicate connections
            if (peerConnections.current.has(remoteUserId)) {
                console.log(`Connection with ${remoteName} already exists, skipping`);
                return;
            }

            console.log(`User ${remoteName} (${remoteUserId}) joined, creating offer`);

            try {
                const pc = createPeerConnection(remoteUserId, remoteName);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.current.emit('webrtc-offer', {
                    groupId,
                    targetUserId: remoteUserId,
                    offer: offer,
                    fromUserId: userId,
                    fromUserName: userName
                });
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        });

        // Receive offer from another user
        socket.current.on('webrtc-offer', async ({ fromUserId, fromUserName, offer }) => {
            if (fromUserId === userId || isCleaningUp.current) return;

            // Prevent duplicate offer processing
            const offerKey = `${fromUserId}-${offer.sdp.substring(0, 50)}`;
            if (processedOffers.current.has(offerKey)) {
                console.log('Duplicate offer detected, ignoring');
                return;
            }
            processedOffers.current.add(offerKey);

            console.log(`Received offer from ${fromUserName} (${fromUserId})`);

            try {
                // Check if connection already exists
                let pc = peerConnections.current.get(fromUserId);

                if (pc && pc.signalingState !== 'stable') {
                    console.log('Closing unstable connection');
                    pc.close();
                    peerConnections.current.delete(fromUserId);
                    pc = null;
                }

                if (!pc) {
                    pc = createPeerConnection(fromUserId, fromUserName);
                }

                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.current.emit('webrtc-answer', {
                    groupId,
                    targetUserId: fromUserId,
                    answer: answer,
                    fromUserId: userId
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        // Receive answer
        socket.current.on('webrtc-answer', async ({ fromUserId, answer }) => {
            if (isCleaningUp.current) return;

            const pc = peerConnections.current.get(fromUserId);
            if (pc && pc.signalingState === 'have-local-offer') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    console.log(`Answer set for connection with ${fromUserId}`);
                } catch (error) {
                    console.error('Error setting remote description:', error);
                }
            }
        });

        // ICE candidate exchange
        socket.current.on('webrtc-ice-candidate', ({ fromUserId, candidate }) => {
            if (isCleaningUp.current) return;

            const pc = peerConnections.current.get(fromUserId);
            if (pc && candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(err => console.error('Error adding ICE candidate:', err));
            }
        });

        // User left the call
        socket.current.on('webrtc-user-left', ({ userId: leftUserId }) => {
            handleUserLeft(leftUserId);
        });
    };

    const createPeerConnection = useCallback((remoteUserId, remoteName) => {
        // Check if connection already exists and is healthy
        const existingPc = peerConnections.current.get(remoteUserId);
        if (existingPc && existingPc.connectionState === 'connected') {
            console.log(`Reusing existing connection with ${remoteName}`);
            return existingPc;
        }

        // Close existing connection if unhealthy
        if (existingPc) {
            existingPc.close();
        }

        console.log(`Creating new peer connection for ${remoteName}`);
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks to peer connection
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        // Handle incoming remote tracks
        pc.ontrack = (event) => {
            console.log(`Received remote track from ${remoteName}`);

            setRemoteStreams(prev => {
                // Prevent duplicate streams
                if (prev.has(remoteUserId)) {
                    console.log('Remote stream already exists, updating');
                }

                const newMap = new Map(prev);
                newMap.set(remoteUserId, {
                    stream: event.streams[0],
                    name: remoteName
                });
                return newMap;
            });
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket.current) {
                socket.current.emit('webrtc-ice-candidate', {
                    groupId,
                    targetUserId: remoteUserId,
                    candidate: event.candidate,
                    fromUserId: userId
                });
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${remoteName}: ${pc.connectionState}`);

            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                handleUserLeft(remoteUserId);
            }
        };

        // ICE connection state
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${remoteName}: ${pc.iceConnectionState}`);
        };

        peerConnections.current.set(remoteUserId, pc);
        return pc;
    }, [localStream, groupId, userId]);

    const handleUserLeft = (leftUserId) => {
        console.log(`User ${leftUserId} left the call`);

        // Close peer connection
        const pc = peerConnections.current.get(leftUserId);
        if (pc) {
            pc.close();
            peerConnections.current.delete(leftUserId);
        }

        // Remove remote stream
        setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(leftUserId);
            return newMap;
        });
    };

    const toggleMute = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (localStream && callType === 'video') {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!videoTrack.enabled);
            }
        }
    };

    const endCall = () => {
        if (socket.current) {
            socket.current.emit('webrtc-leave-call', {
                groupId,
                userId,
                userName
            });
        }
        cleanup();
    };

    const cleanup = () => {
        isCleaningUp.current = true;

        // Stop duration counter
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
            durationInterval.current = null;
        }

        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            setLocalStream(null);
        }

        // Close all peer connections
        peerConnections.current.forEach((pc, id) => {
            try {
                pc.close();
            } catch (error) {
                console.error(`Error closing peer connection ${id}:`, error);
            }
        });
        peerConnections.current.clear();

        // Clear remote streams
        setRemoteStreams(new Map());

        // Clear processed offers
        processedOffers.current.clear();

        // Remove socket listeners
        if (socket.current) {
            socket.current.off('webrtc-user-joined');
            socket.current.off('webrtc-offer');
            socket.current.off('webrtc-answer');
            socket.current.off('webrtc-ice-candidate');
            socket.current.off('webrtc-user-left');
        }

        setIsInitialized(false);
    };

    return {
        localStream,
        remoteStreams,
        callDuration,
        isMuted,
        isCameraOff,
        isInitialized,
        toggleMute,
        toggleCamera,
        endCall
    };
};