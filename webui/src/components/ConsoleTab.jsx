import React, { useState, useMemo, useRef, useEffect } from 'react';
import JSONFormatter from 'json-formatter-js';
import './Tab.css';

// Component for rendering console log message with JSON formatter support
function ConsoleLogMessage({ message, logType }) {
    const messageRef = useRef(null);
    const [isJson, setIsJson] = useState(false);
    const [parsedData, setParsedData] = useState(null);

    useEffect(() => {
        if (!message || !messageRef.current) return;

        // Try to parse as JSON
        try {
            const trimmed = message.trim();
            // Check if it looks like JSON (starts with { or [)
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                const parsed = JSON.parse(trimmed);
                setParsedData(parsed);
                setIsJson(true);

                // Clear and render with JSON formatter
                messageRef.current.innerHTML = '';
                const formatter = new JSONFormatter(parsed, 1, {
                    theme: 'dark',
                    hoverPreviewEnabled: false,
                    hoverPreviewArrayCount: 100,
                    hoverPreviewFieldCount: 5,
                    animateOpen: true,
                    animateClose: true,
                    useToJSON: true
                });
                messageRef.current.appendChild(formatter.render());
            } else {
                setIsJson(false);
                setParsedData(null);
                // Plain text
                messageRef.current.textContent = message;
            }
        } catch (e) {
            // Not valid JSON, display as plain text
            setIsJson(false);
            setParsedData(null);
            messageRef.current.textContent = message;
        }
    }, [message]);

    return (
        <span
            ref={messageRef}
            className={`console-log-message ${isJson ? 'console-log-json' : ''}`}
        />
    );
}

function ConsoleTab({ events, onClear }) {
    const [filterQuery, setFilterQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all'); // all, log, warn, error

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

    const getLogIcon = (type) => {
        switch (type) {
            case 'error':
                return '●';
            case 'warn':
                return '▲';
            default:
                return '●';
        }
    };

    // Filter events based on query and level
    const filteredEvents = useMemo(() => {
        let filtered = events;

        // Filter by level
        if (filterLevel !== 'all') {
            filtered = filtered.filter(log => log.type === filterLevel);
        }

        // Filter by query
        if (filterQuery.trim()) {
            const query = filterQuery.toLowerCase();
            filtered = filtered.filter(log =>
                log.message && log.message.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [events, filterQuery, filterLevel]);

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Console</h2>
                <div className="tab-header-actions">
                    <div className="console-filter-group">
                        <input
                            type="text"
                            className="console-filter-input"
                            placeholder="Filter output..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                        <select
                            className="console-level-filter"
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                        >
                            <option value="all">All levels</option>
                            <option value="log">Log</option>
                            <option value="warn">Warn</option>
                            <option value="error">Error</option>
                        </select>
                    </div>
                    <button onClick={onClear} className="clear-button">Clear console</button>
                </div>
            </div>
            <div className="console-content">
                {events.length === 0 ? (
                    <div className="console-empty-state">No console logs</div>
                ) : filteredEvents.length === 0 ? (
                    <div className="console-empty-state">No console logs match your filter</div>
                ) : (
                    <div className="console-logs">
                        {filteredEvents.map((log, index) => (
                            <div
                                key={index}
                                className={`console-log-item console-log-${log.type}`}
                            >
                                <span
                                    className="console-log-icon"
                                    style={{ color: getLogTypeColor(log.type) }}
                                    title={log.type.toUpperCase()}
                                >
                                    {getLogIcon(log.type)}
                                </span>
                                <ConsoleLogMessage message={log.message} logType={log.type} />
                                <span className="console-log-time" title={new Date(log.timestamp).toLocaleString()}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConsoleTab;

