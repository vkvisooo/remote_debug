import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import './Login.css';

// Convert WebSocket URL to HTTP URL for API calls
const getApiUrl = () => {
    const wsUrl = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';
    // Convert ws:// to http:// or wss:// to https://
    if (wsUrl.startsWith('ws://')) {
        return wsUrl.replace('ws://', 'http://');
    } else if (wsUrl.startsWith('wss://')) {
        return wsUrl.replace('wss://', 'https://');
    }
    return wsUrl; // Already HTTP or fallback
};

const API_URL = getApiUrl();

function Login({ onLogin }) {
    const { theme, toggleTheme } = useTheme();
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userName, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Login failed');
                setLoading(false);
                return;
            }

            if (data.success && data.token) {
                // Store token in localStorage
                localStorage.setItem('authToken', data.token);
                const userNameToStore = data.user?.userName || data.userName || userName;
                localStorage.setItem('userName', userNameToStore);
                onLogin(data.token, data.user || { userName: userNameToStore });
            } else {
                setError('Invalid response from server');
            }
        } catch (err) {
            setError('Failed to connect to server. Please check if the server is running.');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <button onClick={toggleTheme} className="login-theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                {theme === 'dark' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                )}
            </button>
            <div className="login-box">
                <h1>Remote Debug</h1>
                <h2>Sign In</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="userName">Username</label>
                        <input
                            id="userName"
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Enter username"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;

