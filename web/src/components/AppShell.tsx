import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { colors } from '../styles/theme';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        className="pt-app-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          backgroundColor: colors.midnight,
          color: colors.porcelain,
          boxShadow: '0 2px 8px rgba(15, 30, 51, 0.15)',
        }}
      >
        <div className="pt-app-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/logo/pangtao.svg"
            alt="Pangtao Logo"
            style={{ width: '24px', height: '24px', display: 'block', objectFit: 'contain' }}
          />
          <h1 style={{ margin: 0, lineHeight: 0 }}>
            {/* The wordmark is filled with currentColor, which an <img> cannot inherit, so the SVG
                is used as a mask over the brand colour (179 × 46 viewBox → 86 × 22 px). */}
            <span
              role="img"
              aria-label="Pangtao"
              style={{
                display: 'block',
                width: '86px',
                height: '22px',
                backgroundColor: colors.brass,
                WebkitMaskImage: 'url(/logo/pangtao-wordmark.svg)',
                maskImage: 'url(/logo/pangtao-wordmark.svg)',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          </h1>
          <span className="pt-app-header-subtitle" style={{ fontSize: '0.875rem', color: colors.parchment, opacity: 0.8 }}>Personal Ledger</span>
        </div>

        {user && (
          <div className="pt-app-user" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>{user.displayName}</span>
              <span className={`pt-role-badge pt-role-badge--${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: colors.porcelain,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '0.375rem',
                padding: '0.4rem 0.8rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background-color 0.2s',
              }}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};
