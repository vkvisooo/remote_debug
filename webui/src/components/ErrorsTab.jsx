import React from 'react';
import './Tab.css';

function ErrorsTab({ events, onClear }) {
    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Errors</h2>
                <button onClick={onClear} className="clear-button">Clear</button>
            </div>
            <div className="tab-content-scrollable">
                {events.length === 0 ? (
                    <div className="empty-state">No errors</div>
                ) : (
                    <div className="errors-list">
                        {events.map((error, index) => (
                            <div key={index} className="error-item">
                                <div className="error-header">
                                    <span className="error-fatal">{error.fatal ? 'FATAL' : 'ERROR'}</span>
                                    <span className="error-time">
                                        {new Date(error.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="error-message">{error.message}</div>
                                {(error.fileName || error.line || error.function) && (
                                    <div className="error-location">
                                        {error.function && (
                                            <span className="error-function">{error.function}()</span>
                                        )}
                                        {error.fileName && (
                                            <span className="error-file">
                                                {error.fileName.split('/').pop()}
                                                {error.line && `:${error.line}`}
                                                {error.column && `:${error.column}`}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {error.stack && (
                                    <pre className="error-stack">{error.stack}</pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ErrorsTab;

