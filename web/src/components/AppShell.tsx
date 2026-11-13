import React from 'react';
import { useAuth } from '../context/AuthContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { colors } from '../styles/theme';
import { Icon } from './Icon';

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
      <div className="pt-page-bg" aria-hidden="true">
        <div className="pt-page-orb-1" />
        <div className="pt-page-orb-2" />
      </div>
      {/* Full-width bar; its content shares <main>'s 1280 px column so the edges line up. */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: colors.midnight,
          color: colors.porcelain,
          boxShadow: '0 2px 8px rgba(15, 30, 51, 0.15)',
        }}
      >
        <div
          className="pt-app-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            maxWidth: '1280px',
            minHeight: '3.5rem',
            margin: '0 auto',
            padding: '0.5rem 2rem',
          }}
        >
          <div className="pt-app-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
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
                  backgroundColor: '#ffffff',
                  WebkitMaskImage: 'url(/logo/pangtao-wordmark.svg)',
                  maskImage: 'url(/logo/pangtao-wordmark.svg)',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            </h1>
          </div>

          {/* On narrow screens the nav shares the logo's line, so the header keeps its height (NFR-08). */}
          {user?.role === 'USER' && (
            <nav aria-label="Main" className="pt-app-nav">
              <NavLink to="/" end data-testid="nav-dashboard" className="pt-nav-link">
                Dashboard
              </NavLink>
              <NavLink to="/transactions" end data-testid="nav-history" className="pt-nav-link">
                History
              </NavLink>
              <NavLink to="/summary" end data-testid="nav-summary" className="pt-nav-link">
                Summary
              </NavLink>
            </nav>
          )}

          {user && (
            <div className="pt-app-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{user.displayName}</span>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Icon name="logout" size={1.125} />
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1280px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </div>
  );
};
