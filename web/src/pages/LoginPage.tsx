import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ApiErrorResponse } from '../types/auth.types';
import { colors, radius, zIndex } from '../styles/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [emailError, setEmailError]       = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [isSubmitting, setSubmit]         = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate(user.role === 'ADMIN' ? '/admin/users' : '/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setEmailError(null);
    setPasswordError(null);

    let hasClientError = false;

    if (!email.trim()) {
      setEmailError('Email address is required');
      hasClientError = true;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      hasClientError = true;
    }

    if (!password) {
      setPasswordError('Password is required');
      hasClientError = true;
    }

    if (hasClientError) {
      return;
    }

    setSubmit(true);
    try {
      await login(email, password);
    } catch (err) {
      const apiError = err as ApiErrorResponse;

      // Map server-side Zod/field validation errors if returned
      if (apiError?.error?.details && apiError.error.details.length > 0) {
        for (const detail of apiError.error.details) {
          if (detail.field === 'email') setEmailError(detail.issue);
          if (detail.field === 'password') setPasswordError(detail.issue);
        }
      }

      // Display global error banner for credentials / rate limit failures
      setErrorMsg(apiError?.error?.message || 'Invalid email or password');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: colors.porcelain,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Card container anchoring both ambient orbs to the card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '416px',
        }}
      >
        {/* Ambient orbs hugging card borders */}
        <div className="pt-orb-1" aria-hidden="true" />
        <div className="pt-orb-2" aria-hidden="true" />

        {/* Glass login card */}
        <div
          className="pt-glass-card"
          style={{
            width: '100%',
            borderRadius: radius['2xl'],
            padding: '2.5rem 2rem',
            position: 'relative',
            zIndex: zIndex.card,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <img
                src="/logo/pangtao.svg"
                alt="Pangtao Logo"
                style={{
                  width: '52px',
                  height: '52px',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            </div>

            <h1
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0 0.5rem',
              }}
            >
              <img
                src="/logo/pangtao-wordmark.svg"
                alt="Pɑnɡtao"
                style={{
                  height: '32px',
                  width: 'auto',
                  display: 'block',
                }}
              />
            </h1>
            <p style={{ color: colors.cobalt, margin: 0, fontSize: '0.875rem', lineHeight: 1.45, opacity: 0.75 }}>
              Log in to your Pangtao account
            </p>
          </div>

          {errorMsg && <ErrorBanner message={errorMsg} />}

          <form
            onSubmit={handleSubmit}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  //letterSpacing: '0.01em',
                  color: colors.midnight,
                  marginBottom: '0.375rem',
                }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                className={`pt-glass-input ${emailError ? 'pt-glass-input--error' : ''}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter your email address"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                required
              />
              <div className="pt-field-error-slot">
                {emailError && (
                  <span id="email-error" className="pt-field-error" role="alert">
                    {emailError}
                  </span>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: colors.midnight,
                  marginBottom: '0.375rem',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`pt-glass-input ${passwordError ? 'pt-glass-input--error' : ''}`}
                  style={{ paddingRight: '2.5rem' }}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••"
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.cobalt,
                    opacity: 0.65,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.65')}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
              <div className="pt-field-error-slot">
                {passwordError && (
                  <span id="password-error" className="pt-field-error" role="alert">
                    {passwordError}
                  </span>
                )}
              </div>
            </div>

            {/* Submit */}
            <div style={{ paddingTop: '0.625rem' }}>
              <button type="submit" className="pt-glass-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Logging in…' : 'Log in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
