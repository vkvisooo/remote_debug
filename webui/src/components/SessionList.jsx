import React from 'react';
import './SessionList.css';

function SessionList({ sessions, selectedDeviceId, onSelectDeviceId }) {
    const getStatusColor = (status) => {
        switch (status) {
            case 'success':
                return '#4caf50';
            case 'error':
                return '#f44336';
            default:
                return '#ff9800';
        }
    };

    return (
        <div className="session-list">
            <div className="session-list-header">
                <h3>Sessions</h3>
                <span className="session-count">{sessions.length}</span>
            </div>
            <div className="session-items">
                {sessions.length === 0 ? (
                    <div className="no-sessions">No active sessions</div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.deviceId}
                            className={`session-item ${selectedDeviceId === session.deviceId ? 'selected' : ''}`}
                            onClick={() => onSelectDeviceId(session.deviceId)}
                        >
                            <div className="session-header">
                                <span className="session-status" style={{ backgroundColor: getStatusColor(session.status) }}></span>
                                <span className="session-device-id">{session.deviceId}</span>
                            </div>
                            <div className="session-info">
                                <div className="session-meta">
                                    {session.errorCount > 0 && (
                                        <span className="error-count">{session.errorCount} errors</span>
                                    )}
                                    <span className="session-time">
                                        {new Date(session.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default SessionList;

