import React from 'react';
import './Tab.css';

function ConsoleTab({ events, onClear }) {
    const getLogTypeColor = (type) => {
        switch (type) {
            case 'error':
                return '#f44336';
            case 'warn':
                return '#ff9800';
            default:
                return '#4caf50';
        }
    };

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Console Logs</h2>
                <button onClick={onClear} className="clear-button">Clear</button>
            </div>
            <div className="tab-content-scrollable">
                {events.length === 0 ? (
                    <div className="empty-state">No console logs</div>
                ) : (
                    <div className="console-logs">
                        {events.map((log, index) => (
                            <div key={index} className="console-log-item">
                                <span
                                    className="log-type"
                                    style={{ color: getLogTypeColor(log.type) }}
                                >
                                    [{log.type.toUpperCase()}]
                                </span>
                                <span className="log-time">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="log-message">{log.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConsoleTab;

