import React from 'react';
import { AppShell } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { useNavigate } from 'react-router-dom';

export const NotPermittedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626', marginBottom: '1rem' }}>
          403 - Not Permitted
        </h2>
        <p style={{ color: '#64748b', fontSize: '1.125rem', marginBottom: '2rem' }}>
          You do not have permission to access this administrative resource.
        </p>
        <button
          onClick={() => navigate('/')}
          className="pt-btn-primary"
        >
          <Icon name="home" size={1.125} />
          Return to Dashboard
        </button>
      </div>
    </AppShell>
  );
};
