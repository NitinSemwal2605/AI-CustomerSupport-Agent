import React, { useState } from 'react';
import { Mail, Lock, User, Sparkles, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function AuthModal({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please try again.');
      } else {
        localStorage.setItem('gemini_auth_token', data.token);
        localStorage.setItem('gemini_auth_user', JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      setError('Network error: Could not reach backend server on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('nitin@gmail.com');
    setPassword('password123');
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nitin@gmail.com', password: 'password123' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('gemini_auth_token', data.token);
        localStorage.setItem('gemini_auth_user', JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.error || 'Demo login failed');
      }
    } catch (err) {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-circle">
            <Sparkles size={24} color="#ffffff" />
          </div>
          <h2 className="auth-title">
            {isRegister ? 'Create your account' : 'Welcome to ClosedGPT'}
          </h2>
          <p className="auth-subtitle">
            {isRegister
              ? 'Sign up with your Gmail username and password'
              : 'Sign in with your Gmail credentials to continue'}
          </p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="auth-field">
              <label className="auth-label">Your Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Nitin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Gmail / Username</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="text"
                className="auth-input"
                placeholder="username@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Please wait...</span>
              </>
            ) : (
              <>
                <span>{isRegister ? 'Sign Up' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button type="button" className="demo-account-btn" onClick={handleDemoLogin} disabled={loading}>
          Instant Demo Login (<code>nitin@gmail.com</code>)
        </button>

        <div className="auth-footer-toggle">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                }}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                className="toggle-auth-btn"
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                }}
              >
                Create one
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
