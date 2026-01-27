import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Login from './components/Login';
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
import { getApiUrl, fetchDeviceInfo } from './api';
import { createWebSocketConnection, shouldReconnectWebSocket } from './websocket';
import { useTheme } from './ThemeContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || DEFAULTS.SERVER_URL;
const API_URL = getApiUrl(SERVER_URL);

function App() {
    const { theme, toggleTheme } = useTheme();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState(null);
    const [userName, setUserName] = useState('');
    const [activeTab, setActiveTab] = useState(TAB_IDS.NETWORK);
    const [ws, setWs] = useState(null);
    const [connected, setConnected] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    // Ref to always get the latest selectedDeviceId value (avoids stale closure issues)
    const selectedDeviceIdRef = useRef(null);

    // Device info state
    const [deviceInfo, setDeviceInfo] = useState({ deviceName: null, modelName: null, drmSupport: [] });

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

    // Check for existing token on mount
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const storedUserName = localStorage.getItem('userName');
        if (token) {
            setAuthToken(token);
            setUserName(storedUserName || '');
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (token, user) => {
        setAuthToken(token);
        setUserName(user.userName || '');
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        setAuthToken(null);
        setUserName('');
        setIsAuthenticated(false);
        // Close WebSocket connection
        if (ws) {
            ws.close();
            setWs(null);
            setConnected(false);
        }
    };

    // Don't connect WebSocket if not authenticated
    useEffect(() => {
        if (!isAuthenticated || !authToken) {
            return;
        }
        let isMounted = true;
        let reconnectTimeout = null;
        let currentWs = null;

        const connectWebSocket = () => {
            // Check if there's already a connection in state (from previous render)
            if (ws) {
                const state = ws.readyState;
                if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
                    console.warn('[WebUI] WebSocket already connected/connecting (from state), skipping new connection');
                    return;
                }
            }

            // Don't create new connection if already connected or connecting
            if (currentWs) {
                const state = currentWs.readyState;
                if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
                    console.warn('[WebUI] WebSocket already connected/connecting (from currentWs), skipping new connection');
                    return;
                }
            }

            // Close any existing connection before creating a new one
            if (currentWs) {
                console.warn('[WebUI] Closing existing WebSocket connection before creating new one');
                try {
                    currentWs.close();
                } catch (error) {
                    console.error('[WebUI] Error closing existing connection:', error);
                }
                currentWs = null;
            }

            // Also close connection from state if it exists
            if (ws && ws !== currentWs) {
                console.warn('[WebUI] Closing WebSocket connection from state before creating new one');
                try {
                    ws.close();
                } catch (error) {
                    console.error('[WebUI] Error closing connection from state:', error);
                }
            }

            const token = localStorage.getItem('authToken') || authToken;
            const websocket = createWebSocketConnection(
                SERVER_URL,
                token,
                (ws) => {
                    if (!isMounted) {
                        ws.close();
                        return;
                    }
                    console.error('Connected to debug server');
                    setConnected(true);
                    setWs(ws);
                    currentWs = ws;
                },
                (message) => {
                    if (!isMounted) return;
                    if (message.type === MESSAGE_TYPES.EVENT) {
                        console.error('[WebUI] Received EVENT message:', message.payload?.eventType, 'device:', message.deviceId, 'timestamp:', message.payload?.timestamp);
                    } else {
                        console.error('[WebUI] Received message:', message.type, message.deviceId);
                    }
                    handleServerMessage(message);
                },
                (error) => {
                    console.error('WebSocket error:', error);
                    if (isMounted) {
                        setConnected(false);
                    }
                },
                (event) => {
                    console.error('WebSocket closed', `code: ${event.code}, reason: ${event.reason}`);
                    currentWs = null;

                    if (!isMounted) return;

                    setConnected(false);
                    setWs(null);

                    if (shouldReconnectWebSocket(event)) {
                        console.log(`[WebUI] Will reconnect in ${WS_CONFIG.RECONNECT_DELAY}ms (close code: ${event.code})`);
                        reconnectTimeout = setTimeout(() => {
                            if (isMounted) {
                                connectWebSocket();
                            }
                        }, WS_CONFIG.RECONNECT_DELAY);
                    } else {
                        console.log(`[WebUI] Not reconnecting (close code: ${event.code}, reason: ${event.reason})`);
                    }
                }
            );

            if (websocket) {
                currentWs = websocket;
            }
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
    }, [isAuthenticated, authToken]);

    // Keep ref in sync with state
    useEffect(() => {
        selectedDeviceIdRef.current = selectedDeviceId;
    }, [selectedDeviceId]);

    // Fetch device info from server
    const fetchDeviceInfoCallback = useCallback(async (deviceId) => {
        const info = await fetchDeviceInfo(deviceId, authToken, API_URL);
        setDeviceInfo(info);
    }, [authToken]);

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
            setDeviceInfo({ deviceName: null, modelName: null, drmSupport: [] });
            return;
        }

        const events = loadDeviceEvents(eventsRef, commandResponsesRef, selectedDeviceId);
        setNetworkEvents(events.networkEvents);
        setConsoleEvents(events.consoleEvents);
        setErrorEvents(events.errorEvents);
        setPlaybackEvents(events.playbackEvents);
        setMetrics(events.metrics);
        setCommandResponses(events.commandResponses);

        // Fetch device info when device changes
        fetchDeviceInfoCallback(selectedDeviceId);
    }, [selectedDeviceId, authToken, fetchDeviceInfoCallback]);

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

    // Show login page if not authenticated
    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>Remote Debug Tool</h1>
                <div className="header-right">
                    <div className="user-info">
                        <span className="user-name">{userName}</span>
                        <button onClick={handleLogout} className="logout-button">Logout</button>
                    </div>
                    <div className="connection-status">
                        <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
                        <span>{connected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                        {theme === 'dark' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        )}
                    </button>
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
                            // Fetch device info when device is selected
                            if (deviceId && authToken) {
                                fetchDeviceInfoCallback(deviceId);
                            }
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
                            <PlaybackTab
                                events={playbackEvents}
                                onClear={() => clearEvents('playback')}
                                deviceInfo={deviceInfo}
                            />
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

