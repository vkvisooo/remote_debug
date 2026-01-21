import React, { useMemo } from 'react';
import './Tab.css';
import './PlaybackTab.css';

function PlaybackTab({ events, onClear }) {
    const formatValue = (value) => {
        if (value === null || value === undefined) {
            return 'N/A';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const getValueColor = (value) => {
        if (typeof value === 'boolean') {
            return value ? '#4caf50' : '#f44336'; // Green for true, red for false
        }
        return '#ccc'; // Default color
    };

    // Accumulate device details from all "deviceDetails" state events
    const accumulatedDeviceDetails = useMemo(() => {
        let deviceDetails = {};
        events.forEach(event => {
            if (event.state === 'deviceDetails') {
                // Merge all properties from deviceDetails events
                deviceDetails = event
            }
        });
        return deviceDetails;
    }, [events?.state === 'deviceDetails']);

    // Get the latest playerState event
    const latestPlayerState = useMemo(() => {
        // Find the most recent playerState event
        const playerStateEvents = events.filter(event => event.state === 'playerState');
        return playerStateEvents.length > 0
            ? playerStateEvents[playerStateEvents.length - 1]
            : null;
    }, [events]);

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Playback Events</h2>
                <button onClick={onClear} className="clear-button">Clear</button>
            </div>
            <div className="tab-content-scrollable">
                {events.length === 0 ? (
                    <div className="empty-state">No playback events</div>
                ) : (
                    <div className="playback-container">
                        <div className="playback-two-columns">
                            {/* Device Details Column - Left Half */}
                            <div className="playback-column playback-device-column">
                                <h3 className="playback-column-title">Device Details</h3>
                                <div className="playback-details-list">
                                    {Object.keys(accumulatedDeviceDetails).length === 0 ? (
                                        <div className="playback-empty-message">No device details available</div>
                                    ) : (
                                        accumulatedDeviceDetails.results).map((value, index) => (
                                            <div key={index} className="playback-detail-item">
                                                <div className="playback-detail-label">
                                                    <span className="playback-detail-value playback-detail-label-value">
                                                        {value.name}
                                                    </span>
                                                    <span className="playback-detail-value">
                                                        Supported <b style={{ color: getValueColor(value.supported) }}>{formatValue(value.supported)}</b>
                                                    </span>
                                                    <span className="playback-detail-value">
                                                        {`Security Level: ${value.securityLevel}`}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {typeof accumulatedDeviceDetails?.isEMESupported !== "undefined" && <span className="playback-detail-value">
                                        {`EME Supported: ${accumulatedDeviceDetails.isEMESupported}`}
                                    </span>}
                                </div>
                            </div>

                            {/* Player State Column - Right Half */}
                            <div className="playback-column playback-player-column">
                                <h3 className="playback-column-title">Player State</h3>
                                <div className="playback-details-list">
                                    {!latestPlayerState ? (
                                        <div className="playback-empty-message">No player state available</div>
                                    ) : (
                                        <>
                                            {latestPlayerState.readyState !== undefined && (
                                                <div className="playback-detail-item">
                                                    <span className="playback-detail-label">Ready State:</span>
                                                    <span className="playback-detail-value">
                                                        {latestPlayerState.readyState}
                                                    </span>
                                                </div>
                                            )}
                                            {latestPlayerState.bufferHealth !== undefined && (
                                                <div className="playback-detail-item">
                                                    <span className="playback-detail-label">Buffer Health:</span>
                                                    <span className="playback-detail-value">
                                                        {typeof latestPlayerState.bufferHealth === 'number'
                                                            ? `${latestPlayerState.bufferHealth.toFixed(2)}s`
                                                            : formatValue(latestPlayerState.bufferHealth)}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Iterate through all properties in playerState event */}
                                            {Object.keys(latestPlayerState).filter(key =>
                                                !['state', 'timestamp'].includes(key)
                                            ).map(key => {
                                                // Skip if already displayed above
                                                if (key === 'readyState' || key === 'bufferHealth') {
                                                    return null;
                                                }
                                                const value = latestPlayerState[key];
                                                return (
                                                    <div key={key} className="playback-detail-item">
                                                        <span className="playback-detail-label">{key}:</span>
                                                        <span
                                                            className="playback-detail-value"
                                                            style={{ color: getValueColor(value) }}
                                                        >
                                                            {formatValue(value)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlaybackTab;

