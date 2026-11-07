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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/logo/pangtao.svg"
            alt="Pangtao Logo"
            style={{ width: '24px', height: '24px', display: 'block', objectFit: 'contain' }}
          />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: colors.brass }}>Pangtao</h1>
          <span style={{ fontSize: '0.875rem', color: colors.parchment, opacity: 0.8 }}>Personal Ledger</span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
