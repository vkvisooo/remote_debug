import React, { useState, useMemo } from 'react';
import JSONFormatter from 'json-formatter-js';
import './Tab.css';

function NetworkTab({ events, onClear }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const previewRef = React.useRef(null);

    const getStatusColor = (status) => {
        if (status >= 200 && status < 300) return '#4caf50';
        if (status >= 300 && status < 400) return '#ff9800';
        if (status >= 400) return '#f44336';
        return '#666';
    };

    // Filter events based on search query
    const filteredEvents = useMemo(() => {
        if (!searchQuery.trim()) return events;
        const query = searchQuery.toLowerCase();
        return events.filter(event =>
            event.url && event.url.toLowerCase().includes(query)
        );
    }, [events, searchQuery]);

    // Handle row click to show preview
    const handleRowClick = (event) => {
        setSelectedEvent(event);
    };

    // Close preview
    const handleClosePreview = () => {
        setSelectedEvent(null);
    };

    // Render preview content
    React.useEffect(() => {
        if (selectedEvent && previewRef.current) {
            previewRef.current.innerHTML = '';
            const formatter = new JSONFormatter(selectedEvent, 2, {
                theme: 'dark',
                hoverPreviewEnabled: false,
                hoverPreviewArrayCount: 100,
                hoverPreviewFieldCount: 5,
                animateOpen: true,
                animateClose: true,
                useToJSON: true
            });
            previewRef.current.appendChild(formatter.render());
        }
    }, [selectedEvent]);

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Network Events</h2>
                <div className="tab-header-actions">
                    <input
                        type="text"
                        className="network-search-input"
                        placeholder="Search by URL..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button onClick={onClear} className="clear-button">Clear</button>
                </div>
            </div>
            <div className="network-split-container">
                <div className="network-table-container">
                    {events.length === 0 ? (
                        <div className="empty-state">No network events</div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="empty-state">No network events match your search</div>
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
                                {filteredEvents.map((event, index) => (
                                    <tr
                                        key={index}
                                        className={`network-row-clickable ${selectedEvent === event ? 'network-row-selected' : ''}`}
                                        onClick={() => handleRowClick(event)}
                                    >
                                        <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                                        <td><span className="method-badge">{event.method}</span></td>
                                        <td className="url-cell" title={event.url}>{event.url}</td>
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

                {/* Preview Panel on Right Side */}
                <div className={`network-preview-panel ${selectedEvent ? 'network-preview-panel-visible' : ''}`}>
                    {selectedEvent ? (
                        <>
                            <div className="network-preview-header">
                                <h3>Preview</h3>
                                <button className="network-preview-close" onClick={handleClosePreview}>×</button>
                            </div>
                            <div className="network-preview-content">
                                <div className="network-preview-url">
                                    <strong>URL:</strong> {selectedEvent.url}
                                </div>
                                <div className="network-preview-details">
                                    <div className="network-preview-detail-item">
                                        <strong>Method:</strong> {selectedEvent.method || 'N/A'}
                                    </div>
                                    <div className="network-preview-detail-item">
                                        <strong>Status:</strong>
                                        <span style={{ color: getStatusColor(selectedEvent.status), marginLeft: '0.5rem' }}>
                                            {selectedEvent.status || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="network-preview-detail-item">
                                        <strong>Duration:</strong> {selectedEvent.duration || 0}ms
                                    </div>
                                    <div className="network-preview-detail-item">
                                        <strong>Phase:</strong> {selectedEvent.phase || 'other'}
                                    </div>
                                    <div className="network-preview-detail-item">
                                        <strong>Time:</strong> {new Date(selectedEvent.timestamp).toLocaleString()}
                                    </div>
                                </div>
                                <div className="network-preview-json-container">
                                    <div className="network-preview-json-label">Event Data:</div>
                                    <div ref={previewRef} className="network-preview-json"></div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="network-preview-empty">
                            <p>Select a network event to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default NetworkTab;

