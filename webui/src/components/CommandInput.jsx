import React, { useState, useRef, useEffect } from 'react';
import './CommandInput.css';

function CommandInput({ onSendCommand, responses = [], onClearResponses }) {
    const [command, setCommand] = useState('');
    const [params, setParams] = useState('');
    const responsesEndRef = useRef(null);

    const scrollToBottom = () => {
        responsesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [responses]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        let parsedParams = {};

        if (params.trim()) {
            try {
                parsedParams = JSON.parse(params);
            } catch (error) {
                alert('Invalid JSON parameters');
                return;
            }
        }

        onSendCommand(command.trim(), parsedParams);
        setCommand('');
        setParams('');
    };

    const formatResponse = (response) => {
        if (!response.success) {
            return { formatted: `Error: ${response.error || 'Unknown error'}`, type: 'error' };
        }

        const result = response.result;
        const resultType = response.resultType || typeof result;

        if (resultType === 'object' || (typeof result === 'object' && result !== null)) {
            try {
                return {
                    formatted: JSON.stringify(result, null, 2),
                    type: 'object'
                };
            } catch (e) {
                return {
                    formatted: String(result),
                    type: 'string'
                };
            }
        } else if (resultType === 'string') {
            return {
                formatted: String(result),
                type: 'string'
            };
        } else if (resultType === 'boolean') {
            return {
                formatted: String(result),
                type: 'boolean'
            };
        } else if (resultType === 'number') {
            return {
                formatted: String(result),
                type: 'number'
            };
        } else if (result === null) {
            return {
                formatted: 'null',
                type: 'null'
            };
        } else if (result === undefined) {
            return {
                formatted: 'undefined',
                type: 'undefined'
            };
        } else {
            return {
                formatted: String(result),
                type: 'other'
            };
        }
    };

    return (
        <div className="command-input">
            <form onSubmit={handleSubmit}>
                <div className="command-row">
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Enter JavaScript expression (e.g., window.SPN_PLAYER_OBJ.play())"
                        className="command-field"
                        style={{ flex: 2 }}
                    />
                    <input
                        type="text"
                        value={params}
                        onChange={(e) => setParams(e.target.value)}
                        placeholder='Optional params (JSON, e.g. {"key": "value"})'
                        className="params-field"
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="send-button">Execute</button>
                </div>
            </form>
            <div className="command-hint">
                Examples: window.SPN_PLAYER_OBJ.play() | window[key][key][flag] | window[key][key][method]()
            </div>

            {responses.length > 0 && (
                <div className="command-responses">
                    <div className="command-responses-header">
                        <h4>Command Responses</h4>
                        <button
                            className="clear-responses-button"
                            onClick={onClearResponses}
                            title="Clear responses"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="command-responses-list">
                        {responses.map((response, index) => {
                            const { formatted, type } = formatResponse(response);
                            return (
                                <div
                                    key={index}
                                    className={`command-response response-${type} ${!response.success ? 'response-error' : ''}`}
                                >
                                    <div className="response-time">
                                        {new Date(response.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div className="response-content">
                                        {type === 'object' ? (
                                            <pre className="response-pre">{formatted}</pre>
                                        ) : (
                                            <span className={`response-value response-${type}`}>
                                                {formatted}
                                            </span>
                                        )}
                                        {response.stack && (
                                            <pre className="response-stack">{response.stack}</pre>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={responsesEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default CommandInput;

