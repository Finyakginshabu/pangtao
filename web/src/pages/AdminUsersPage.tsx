import React from 'react';
import { AppShell } from '../components/AppShell';

export const AdminUsersPage: React.FC = () => {
  return (
    <AppShell>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
          User Account Administration
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Manage platform users and access activation.
        </p>

        <div
          style={{
            padding: '2rem',
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          Administrator User Management view (Feature F-02).
        </div>
      </div>
    </AppShell>
  );
};
