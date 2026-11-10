import React from 'react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  return (
    <div role="alert" className="pt-error-banner">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: '#8B2525',
            color: '#fff',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
};
