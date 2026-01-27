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

    // Determine device type from deviceName
    const getDeviceType = (deviceName) => {
        if (!deviceName) return 'desktop';
        const name = deviceName.toLowerCase();

        // TV detection
        if (name.includes('tv') || name.includes('samsung tv') || name.includes('lg tv')) {
            return 'tv';
        }

        // Mobile detection
        if (name.includes('iphone') || name.includes('ipad') || name.includes('mobile')) {
            return 'mobile';
        }

        // Default to desktop
        return 'desktop';
    };

    // Get device icon based on device type
    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'tv':
                return (
                    <svg fill="currentColor" height="200px" width="200px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 50 50" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Layer_1"> <path d="M1,38h23v3H12v2h26v-2H26v-3h23V8H1V38z M3,10h44v26H3V10z"></path> </g> <g> </g> </g></svg>
                );
            case 'mobile':
                return (
                    <svg className="device-icon mobile" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11 18H13M9.2 21H14.8C15.9201 21 16.4802 21 16.908 20.782C17.2843 20.5903 17.5903 20.2843 17.782 19.908C18 19.4802 18 18.9201 18 17.8V6.2C18 5.0799 18 4.51984 17.782 4.09202C17.5903 3.71569 17.2843 3.40973 16.908 3.21799C16.4802 3 15.9201 3 14.8 3H9.2C8.0799 3 7.51984 3 7.09202 3.21799C6.71569 3.40973 6.40973 3.71569 6.21799 4.09202C6 4.51984 6 5.07989 6 6.2V17.8C6 18.9201 6 19.4802 6.21799 19.908C6.40973 20.2843 6.71569 20.5903 7.09202 20.782C7.51984 21 8.07989 21 9.2 21Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                );
            case 'desktop':
            default:
                return (
                    <svg className="device-icon desktop" viewBox="0 0 512 512" fill="currentColor" stroke="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path class="st0" d="M510.163,392.022l-45.59-57.326V93.611c0-11.662-9.458-21.12-21.12-21.12H68.546 c-11.662,0-21.115,9.458-21.115,21.12v241.085L1.837,392.022C0.648,393.517,0,395.367,0,397.287v25.373 c0,9.311,7.542,16.849,16.849,16.849h478.302c9.307,0,16.849-7.538,16.849-16.849v-25.373 C512,395.367,511.356,393.517,510.163,392.022z M77.226,102.291h357.548v202.606H77.226V102.291z M304.121,419.47h-96.242v-25.478 h96.242V419.47z"></path> </g> </g></svg>
                );
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
                                <div className="session-icon-wrapper" style={{ color: getStatusColor(session.status) }}>
                                    {getDeviceIcon(getDeviceType(session.deviceName))}
                                </div>
                                <span className="session-device-id">{session.deviceName || session.deviceId}</span>
                            </div>
                            <div className="session-info">
                                <div className="session-meta">
                                    {session.errorCount > 0 && (
                                        <span className="error-count">{session.errorCount} errors</span>
                                    )}
                                    <span className="session-time">
                                        {session.modelName} | {new Date(session.timestamp).toLocaleTimeString()}
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

