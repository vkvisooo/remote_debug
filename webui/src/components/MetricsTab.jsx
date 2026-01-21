import React from 'react';
import './Tab.css';

function MetricsTab({ metrics, onClear }) {
    // Group metrics by name
    const groupedMetrics = metrics.reduce((acc, metric) => {
        if (!acc[metric.customName]) {
            acc[metric.customName] = [];
        }
        acc[metric.customName].push(metric);
        return acc;
    }, {});

    return (
        <div className="tab-container">
            <div className="tab-header">
                <h2>Custom Metrics</h2>
                <button onClick={onClear} className="clear-button">Clear</button>
            </div>
            <div className="tab-content-scrollable">
                {metrics.length === 0 ? (
                    <div className="empty-state">No metrics</div>
                ) : (
                    <div className="metrics-container">
                        {Object.entries(groupedMetrics).map(([name, values]) => (
                            <div key={name} className="metric-group">
                                <h3 className="metric-name">{name}</h3>
                                <div className="metric-values">
                                    {values.slice(-20).map((metric, index) => (
                                        <div key={index} className="metric-item">
                                            <span className="metric-value">{metric.value}</span>
                                            <span className="metric-timestamp">
                                                {new Date(metric.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MetricsTab;

