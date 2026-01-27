import React, { useState, useRef, useEffect } from 'react';
import JSONFormatter from 'json-formatter-js';
import { useTheme } from '../ThemeContext';
import './CommandInput.css';

const MAX_HISTORY = 10;
const STORAGE_KEY = 'remoteDebug_commandHistory';

// Component for rendering individual response items
function ResponseItem({ response, formatted }) {
    const responseRef = useRef(null);
    const { theme } = useTheme();

    useEffect(() => {
        if (formatted.isObject && responseRef.current) {
            // Clear previous content
            responseRef.current.innerHTML = '';
            // Create JSON formatter instance
            // Use theme from context
            const formatter = new JSONFormatter(formatted.value, 1, {
                theme: theme,
                hoverPreviewEnabled: false,
                hoverPreviewArrayCount: 100,
                hoverPreviewFieldCount: 5,
                animateOpen: true,
                animateClose: true,
                useToJSON: true
            });
            responseRef.current.appendChild(formatter.render());
        }
    }, [formatted.value, formatted.isObject, theme]);

    return (
        <div className={`command-response response-${formatted.type} ${!response.success ? 'response-error' : ''}`}>
            <div className="response-time">
                {new Date(response.timestamp).toLocaleTimeString()}
            </div>
            <div className="response-content">
                {formatted.isObject ? (
                    <div ref={responseRef} className="json-formatter-container"></div>
                ) : (
                    <code className={`response-value response-${formatted.type}`}>
                        {formatted.value}
                    </code>
                )}
                {response.stack && (
                    <div className="response-stack">
                        <code className="response-stack-text">{response.stack}</code>
                    </div>
                )}
            </div>
        </div>
    );
}

function CommandInput({ onSendCommand, responses = [], onClearResponses }) {
    const [command, setCommand] = useState('');
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempCommand, setTempCommand] = useState('');
    const commandInputRef = useRef(null);
    const responsesEndRef = useRef(null);

    const scrollToBottom = () => {
        responsesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Validate and filter out invalid entries
                    // Support both old format (objects) and new format (strings)
                    const validHistory = parsed
                        .filter(item => {
                            if (typeof item === 'string') return item.trim();
                            if (item && typeof item === 'object' && typeof item.command === 'string') {
                                return item.command.trim();
                            }
                            return false;
                        })
                        .map(item => typeof item === 'string' ? item : item.command)
                        .slice(-MAX_HISTORY);
                    if (validHistory.length > 0) {
                        setCommandHistory(validHistory);
                    }
                }
            }
        } catch (error) {
            console.warn('[CommandInput] Failed to load history from localStorage:', error);
            // Clear invalid data
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {
                // Ignore
            }
        }
    }, []);

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (commandHistory.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(commandHistory));
            } catch (error) {
                console.warn('[CommandInput] Failed to save history to localStorage:', error);
                // Try to clear if quota exceeded
                if (error.name === 'QuotaExceededError') {
                    try {
                        // Remove oldest entries and try again
                        const reduced = commandHistory.slice(-Math.floor(MAX_HISTORY / 2));
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
                        setCommandHistory(reduced);
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        } else {
            // Clear localStorage if history is empty
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                // Ignore
            }
        }
    }, [commandHistory]);

    useEffect(() => {
        scrollToBottom();
    }, [responses]);

    const addToHistory = (cmd) => {
        const trimmedCmd = cmd.trim();
        if (!trimmedCmd) return;

        setCommandHistory(prev => {
            const newHistory = [...prev];
            // Remove if it's a duplicate of the last entry
            if (newHistory.length > 0) {
                const last = newHistory[newHistory.length - 1];
                if (last === trimmedCmd) {
                    return newHistory;
                }
            }
            // Add new entry
            newHistory.push(trimmedCmd);
            // Keep only last MAX_HISTORY entries
            if (newHistory.length > MAX_HISTORY) {
                return newHistory.slice(-MAX_HISTORY);
            }
            return newHistory;
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;

            // If we're at the start (new command), save current input as temp
            if (historyIndex === -1) {
                setTempCommand(command);
            }

            const newIndex = historyIndex === -1
                ? commandHistory.length - 1
                : Math.max(0, historyIndex - 1);

            setHistoryIndex(newIndex);
            const historyItem = commandHistory[newIndex];
            setCommand(historyItem);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;

            const newIndex = historyIndex + 1;
            if (newIndex >= commandHistory.length) {
                // Reached the end, restore temp input
                setHistoryIndex(-1);
                setCommand(tempCommand);
            } else {
                setHistoryIndex(newIndex);
                const historyItem = commandHistory[newIndex];
                setCommand(historyItem);
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        // Send command with empty params (parameters are now part of the command itself)
        onSendCommand(command.trim(), {});

        // Add to history before clearing
        addToHistory(command);

        // Reset state
        setCommand('');
        setHistoryIndex(-1);
        setTempCommand('');
    };

    const formatResponse = (response) => {
        if (!response.success) {
            return {
                value: `Error: ${response.error || 'Unknown error'}`,
                type: 'error',
                isObject: false
            };
        }

        const result = response.result;
        const resultType = response.resultType || typeof result;

        if (resultType === 'object' || (typeof result === 'object' && result !== null)) {
            try {
                // Try to parse as JSON to ensure it's valid
                const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;
                return {
                    value: jsonResult,
                    type: 'object',
                    isObject: true
                };
            } catch (e) {
                return {
                    value: String(result),
                    type: 'string',
                    isObject: false
                };
            }
        } else if (resultType === 'string') {
            return {
                value: String(result),
                type: 'string',
                isObject: false
            };
        } else if (resultType === 'boolean') {
            return {
                value: String(result),
                type: 'boolean',
                isObject: false
            };
        } else if (resultType === 'number') {
            return {
                value: String(result),
                type: 'number',
                isObject: false
            };
        } else if (result === null) {
            return {
                value: 'null',
                type: 'null',
                isObject: false
            };
        } else if (result === undefined) {
            return {
                value: 'undefined',
                type: 'undefined',
                isObject: false
            };
        } else {
            return {
                value: String(result),
                type: 'other',
                isObject: false
            };
        }
    };


    return (
        <div className="command-input">
            <form onSubmit={handleSubmit}>
                <div className="command-row">
                    <input
                        ref={commandInputRef}
                        type="text"
                        value={command}
                        onChange={(e) => {
                            setCommand(e.target.value);
                            setHistoryIndex(-1); // Reset history index when typing
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter JavaScript expression"
                        className="command-field"
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="send-button">Execute</button>
                </div>
            </form>
            <div className="command-hint">
                Examples: window.SPN_PLAYER_OBJ.play()
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
                            const formatted = formatResponse(response);
                            return (
                                <ResponseItem
                                    key={index}
                                    response={response}
                                    formatted={formatted}
                                />
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

