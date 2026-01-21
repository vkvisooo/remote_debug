import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import NetworkTab from './components/NetworkTab';
import ConsoleTab from './components/ConsoleTab';
import ErrorsTab from './components/ErrorsTab';
import PlaybackTab from './components/PlaybackTab';
import MetricsTab from './components/MetricsTab';
import CommandInput from './components/CommandInput';
import SessionList from './components/SessionList';
import { DEFAULTS, WS_CONFIG, TAB_IDS, MESSAGE_TYPES, EVENT_TYPES } from './constants';
import {
    deduplicateSessions,
    createInitialDeviceEvents,
    getWebUISessionId
} from './utils';
import {
    handleSessionMessage,
    handleEventStorage,
    handleCommandResponse,
    loadDeviceEvents,
    clearAllDeviceEvents
} from './helpers';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || DEFAULTS.SERVER_URL;

function App() {
    const [activeTab, setActiveTab] = useState(TAB_IDS.NETWORK);
    const [ws, setWs] = useState(null);
    const [connected, setConnected] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    // Ref to always get the latest selectedDeviceId value (avoids stale closure issues)
    const selectedDeviceIdRef = useRef(null);

    // Event data
    const [networkEvents, setNetworkEvents] = useState([]);
    const [consoleEvents, setConsoleEvents] = useState([]);
    const [errorEvents, setErrorEvents] = useState([]);
    const [playbackEvents, setPlaybackEvents] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [commandResponses, setCommandResponses] = useState([]);

    // Store events per device: { [deviceId]: { network: [], console: [], ... } }
    const eventsRef = useRef({});
    const commandResponsesRef = useRef({});

    useEffect(() => {
        let isMounted = true;
        let reconnectTimeout = null;
        let currentWs = null;

        const connectWebSocket = () => {
            // Don't create new connection if already connected or connecting
            if (currentWs) {
                const state = currentWs.readyState;
                if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
                    console.warn('[WebUI] WebSocket already connected/connecting, skipping new connection');
                    return;
                }
            }

            // Close any existing connection before creating a new one
            if (currentWs) {
                console.warn('[WebUI] Closing existing WebSocket connection before creating new one');
                currentWs.close();
                currentWs = null;
            }

            const sessionId = getWebUISessionId();
            const websocket = new WebSocket(
                `${SERVER_URL}?${WS_CONFIG.QUERY_PARAM_TYPE}=${WS_CONFIG.TYPE_WEBUI}&${WS_CONFIG.QUERY_PARAM_SESSION_ID}=${sessionId}`
            );
            currentWs = websocket;

            websocket.onopen = () => {
                if (!isMounted) {
                    websocket.close();
                    return;
                }
                console.error('Connected to debug server');
                setConnected(true);
                setWs(websocket);
            };

            websocket.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === MESSAGE_TYPES.EVENT) {
                        console.error('[WebUI] Received EVENT message:', message.payload?.eventType, 'device:', message.deviceId, 'timestamp:', message.payload?.timestamp);
                    } else {
                        console.error('[WebUI] Received message:', message.type, message.deviceId);
                    }
                    handleServerMessage(message);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };

            websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (isMounted) {
                    setConnected(false);
                }
            };

            websocket.onclose = (event) => {
                console.error('WebSocket closed', `code: ${event.code}, reason: ${event.reason}`);
                currentWs = null;

                if (!isMounted) return;

                setConnected(false);
                setWs(null);

                // Only reconnect if:
                // 1. Not a normal closure (1000) - means unexpected disconnect
                // 2. Not closed by server due to duplicate (1008 with specific reason)
                // 3. Not a clean shutdown
                const shouldReconnect = event.code !== 1000 &&
                    !(event.code === 1008 && event.reason.includes('same session'));

                if (shouldReconnect) {
                    console.log(`[WebUI] Will reconnect in ${WS_CONFIG.RECONNECT_DELAY}ms (close code: ${event.code})`);
                    reconnectTimeout = setTimeout(() => {
                        if (isMounted) {
                            connectWebSocket();
                        }
                    }, WS_CONFIG.RECONNECT_DELAY);
                } else {
                    console.log(`[WebUI] Not reconnecting (close code: ${event.code}, reason: ${event.reason})`);
                }
            };
        };

        connectWebSocket();

        return () => {
            isMounted = false;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (currentWs) {
                console.log('[WebUI] Cleaning up WebSocket connection on unmount');
                currentWs.close();
            }
        };
    }, []);

    // Keep ref in sync with state
    useEffect(() => {
        selectedDeviceIdRef.current = selectedDeviceId;
    }, [selectedDeviceId]);

    // Update displayed events when selected device changes
    useEffect(() => {
        if (!selectedDeviceId) {
            const cleared = clearAllDeviceEvents();
            setNetworkEvents(cleared.networkEvents);
            setConsoleEvents(cleared.consoleEvents);
            setErrorEvents(cleared.errorEvents);
            setPlaybackEvents(cleared.playbackEvents);
            setMetrics(cleared.metrics);
            setCommandResponses(cleared.commandResponses);
            return;
        }

        const events = loadDeviceEvents(eventsRef, commandResponsesRef, selectedDeviceId);
        setNetworkEvents(events.networkEvents);
        setConsoleEvents(events.consoleEvents);
        setErrorEvents(events.errorEvents);
        setPlaybackEvents(events.playbackEvents);
        setMetrics(events.metrics);
        setCommandResponses(events.commandResponses);
    }, [selectedDeviceId]);

    const connectWebSocket = () => {
        const sessionId = getWebUISessionId();
        const websocket = new WebSocket(
            `${SERVER_URL}?${WS_CONFIG.QUERY_PARAM_TYPE}=${WS_CONFIG.TYPE_WEBUI}&${WS_CONFIG.QUERY_PARAM_SESSION_ID}=${sessionId}`
        );

        websocket.onopen = () => {
            console.error('Connected to debug server');
            setConnected(true);
            setWs(websocket);
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === MESSAGE_TYPES.EVENT) {
                    console.error('[WebUI] Received EVENT message:', message.payload?.eventType, 'device:', message.deviceId, 'timestamp:', message.payload?.timestamp);
                } else {
                    console.error('[WebUI] Received message:', message.type, message.deviceId);
                }
                handleServerMessage(message);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnected(false);
        };

        websocket.onclose = () => {
            console.error('WebSocket closed');
            setConnected(false);
            // Attempt reconnect
            setTimeout(connectWebSocket, WS_CONFIG.RECONNECT_DELAY);
        };
    };

    const handleServerMessage = (message) => {
        switch (message.type) {
            case MESSAGE_TYPES.SESSIONS:
                const deduplicated = deduplicateSessions(message.payload || []);
                setSessions(deduplicated);
                if (deduplicated.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(deduplicated[0].deviceId);
                }
                break;

            case MESSAGE_TYPES.SESSION_CREATED:
            case MESSAGE_TYPES.SESSION_UPDATED:
            case MESSAGE_TYPES.SESSION_CLOSED:
            case MESSAGE_TYPES.SESSION_DELETED:
                handleSessionMessage(message, setSessions, setSelectedDeviceId, selectedDeviceId);
                break;

            case MESSAGE_TYPES.EVENT:
                // Store events for the device they belong to
                if (message.deviceId) {
                    const currentSelectedDeviceId = selectedDeviceIdRef.current;
                    const eventType = message.payload?.eventType;
                    const timestamp = message.payload?.timestamp;
                    const beforeCount = eventsRef.current[message.deviceId]?.[eventType === EVENT_TYPES.NETWORK ? 'network' :
                        eventType === EVENT_TYPES.CONSOLE ? 'console' :
                            eventType === EVENT_TYPES.ERROR ? 'errors' :
                                eventType === EVENT_TYPES.PLAYBACK ? 'playback' :
                                    eventType === EVENT_TYPES.METRIC ? 'metrics' : 'unknown']?.length || 0;

                    console.error(`[WebUI] Handling event: ${eventType} for device: ${message.deviceId}, selected: ${currentSelectedDeviceId}, timestamp: ${timestamp}, beforeCount: ${beforeCount}`);

                    const deviceEvents = handleEventStorage(eventsRef, message.deviceId, message.payload);

                    const afterCount = deviceEvents?.[eventType === EVENT_TYPES.NETWORK ? 'network' :
                        eventType === EVENT_TYPES.CONSOLE ? 'console' :
                            eventType === EVENT_TYPES.ERROR ? 'errors' :
                                eventType === EVENT_TYPES.PLAYBACK ? 'playback' :
                                    eventType === EVENT_TYPES.METRIC ? 'metrics' : 'unknown']?.length || 0;

                    if (afterCount === beforeCount) {
                        console.warn(`[WebUI] WARNING: Event count did not increase! Event may be duplicate. before: ${beforeCount}, after: ${afterCount}`);
                    }

                    // Update UI only if this is the selected device
                    if (currentSelectedDeviceId && message.deviceId === currentSelectedDeviceId && deviceEvents) {
                        console.error('[WebUI] Updating UI with events for selected device:', {
                            network: deviceEvents.network.length,
                            console: deviceEvents.console.length,
                            errors: deviceEvents.errors.length,
                            playback: deviceEvents.playback.length,
                            metrics: deviceEvents.metrics.length
                        });
                        // Create new arrays to ensure React detects the change
                        setNetworkEvents([...deviceEvents.network]);
                        setConsoleEvents([...deviceEvents.console]);
                        setErrorEvents([...deviceEvents.errors]);
                        setPlaybackEvents([...deviceEvents.playback]);
                        setMetrics([...deviceEvents.metrics]);
                    } else if (!currentSelectedDeviceId) {
                        console.warn('[WebUI] Event received but no device selected. Device:', message.deviceId, 'Storing event for later display');
                    }
                }
                break;

            case MESSAGE_TYPES.RESPONSE:
                if (handleCommandResponse(commandResponsesRef, message, selectedDeviceIdRef, setCommandResponses)) {
                    console.log('Command response:', message.payload);
                }
                break;

            default:
                break;
        }
    };


    const sendCommand = (command, params = {}) => {
        if (!ws || !selectedDeviceId) {
            alert('No active device selected');
            return;
        }

        const session = sessions.find(s => s.deviceId === selectedDeviceId);
        if (!session) {
            alert('Device not found');
            return;
        }

        const commandMessage = {
            type: MESSAGE_TYPES.COMMAND,
            deviceId: selectedDeviceId,
            payload: {
                command,
                params
            }
        };
        console.log('[WebUI] Sending command to server:', commandMessage);
        ws.send(JSON.stringify(commandMessage));
    };

    const clearEvents = (type) => {
        if (!selectedDeviceId) return;

        if (!eventsRef.current[selectedDeviceId]) {
            eventsRef.current[selectedDeviceId] = createInitialDeviceEvents();
        }

        const deviceEvents = eventsRef.current[selectedDeviceId];

        switch (type) {
            case TAB_IDS.NETWORK:
                deviceEvents.network = [];
                setNetworkEvents([]);
                break;
            case TAB_IDS.CONSOLE:
                deviceEvents.console = [];
                setConsoleEvents([]);
                break;
            case TAB_IDS.ERRORS:
                deviceEvents.errors = [];
                setErrorEvents([]);
                break;
            case TAB_IDS.PLAYBACK:
                deviceEvents.playback = [];
                setPlaybackEvents([]);
                break;
            case TAB_IDS.METRICS:
                deviceEvents.metrics = [];
                setMetrics([]);
                break;
        }
    };


    const tabs = [
        { id: TAB_IDS.NETWORK, label: 'Network' },
        { id: TAB_IDS.CONSOLE, label: 'Console' },
        { id: TAB_IDS.ERRORS, label: 'Errors' },
        { id: TAB_IDS.PLAYBACK, label: 'Playback' },
        { id: TAB_IDS.METRICS, label: 'Metrics' }
    ];

    return (
        <div className="app">
            <header className="app-header">
                <h1>Remote Debug Tool</h1>
                <div className="connection-status">
                    <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </header>

            <div className="app-content">
                <aside className="sidebar">
                    <SessionList
                        sessions={sessions}
                        selectedDeviceId={selectedDeviceId}
                        onSelectDeviceId={(deviceId) => {
                            console.log('[WebUI] Device selected by click:', deviceId);
                            // Update ref immediately (before state update) so event handlers see the new value
                            selectedDeviceIdRef.current = deviceId;
                            setSelectedDeviceId(deviceId);
                            // Immediately load events for the selected device
                            const events = loadDeviceEvents(eventsRef, commandResponsesRef, deviceId);
                            setNetworkEvents(events.networkEvents);
                            setConsoleEvents(events.consoleEvents);
                            setErrorEvents(events.errorEvents);
                            setPlaybackEvents(events.playbackEvents);
                            setMetrics(events.metrics);
                            setCommandResponses(events.commandResponses);
                        }}
                    />
                </aside>

                <main className="main-content">
                    <div className="tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="tab-content">
                        {activeTab === 'network' && (
                            <NetworkTab events={networkEvents} onClear={() => clearEvents('network')} />
                        )}
                        {activeTab === 'console' && (
                            <ConsoleTab events={consoleEvents} onClear={() => clearEvents('console')} />
                        )}
                        {activeTab === 'errors' && (
                            <ErrorsTab events={errorEvents} onClear={() => clearEvents('errors')} />
                        )}
                        {activeTab === 'playback' && (
                            <PlaybackTab events={playbackEvents} onClear={() => clearEvents('playback')} />
                        )}
                        {activeTab === 'metrics' && (
                            <MetricsTab metrics={metrics} onClear={() => clearEvents('metrics')} />
                        )}
                    </div>

                    <CommandInput onSendCommand={sendCommand} responses={commandResponses} onClearResponses={() => {
                        if (selectedDeviceId) {
                            commandResponsesRef.current[selectedDeviceId] = [];
                            setCommandResponses([]);
                        }
                    }} />
                </main>
            </div>
        </div>
    );
}

export default App;

