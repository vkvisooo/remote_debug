import React from 'react';
import './Tab.css';

function NetworkTab({ events, onClear }) {
    const getStatusColor = (status) => {
        if (status >= 200 && status < 300) return '#4caf50';
        if (status >= 300 && status < 400) return '#ff9800';
        if (status >= 400) return '#f44336';
        return '#666';
    };

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Network Events</h2>
                <button onClick={onClear} className="clear-button">Clear</button>
            </div>
            <div className="tab-content-scrollable">
                {events.length === 0 ? (
                    <div className="empty-state">No network events</div>
                ) : (
                    <table className="events-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Method</th>
                                <th>URL</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Phase</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event, index) => (
                                <tr key={index}>
                                    <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                                    <td><span className="method-badge">{event.method}</span></td>
                                    <td className="url-cell">{event.url}</td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ color: getStatusColor(event.status) }}
                                        >
                                            {event.status || 'N/A'}
                                        </span>
                                    </td>
                                    <td>{event.duration}ms</td>
                                    <td><span className="phase-badge">{event.phase || 'other'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default NetworkTab;

