import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <AppShell>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
          Welcome back, {user?.displayName}
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Overview of your financial accounts and balances.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <h3 style={{ fontSize: '1rem', color: '#64748b', margin: '0 0 0.5rem' }}>Cash & Bank</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>0.00 ฿</p>
          </div>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <h3 style={{ fontSize: '1rem', color: '#64748b', margin: '0 0 0.5rem' }}>Debts (Credit Cards)</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>0.00 ฿</p>
          </div>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <h3 style={{ fontSize: '1rem', color: '#64748b', margin: '0 0 0.5rem' }}>Owed to Me (Loans)</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>0.00 ฿</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
