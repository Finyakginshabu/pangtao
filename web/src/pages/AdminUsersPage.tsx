import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { fetchUsers, updateUserStatus } from '../api/admin.api';
import { AdminUser } from '../types/admin.types';
import { ApiErrorResponse } from '../types/auth.types';
import { colors, font, radius, shadow, space, zIndex } from '../styles/theme';

const PAGE_LIMIT = 50;
const SKELETON_ROWS = 4;

function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as Partial<ApiErrorResponse> | undefined;
  return candidate?.error?.message ?? fallback;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceSolid,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.xl,
  boxShadow: shadow.card,
  overflow: 'hidden',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: `${space[3]} ${space[4]}`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: colors.textMuted,
  borderBottom: `1px solid ${colors.border}`,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: `${space[3]} ${space[4]}`,
  fontSize: font.size.sm,
  color: colors.textPrimary,
  borderBottom: `1px solid ${colors.border}`,
  verticalAlign: 'middle',
};

function actionButtonStyle(enable: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: '0.35rem 0.85rem',
    borderRadius: radius.md,
    border: `1px solid ${enable ? '#2F7D5B' : '#A94444'}`,
    backgroundColor: enable ? '#E7F4EE' : '#FBEAEA',
    color: enable ? '#1F5C42' : '#8B2525',
    fontWeight: font.weight.semibold,
    fontSize: font.size.xs,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
  };
}

const skeletonBar: React.CSSProperties = {
  display: 'inline-block',
  height: '0.85rem',
  borderRadius: radius.full,
  backgroundColor: '#E8E2D6',
};

const SkeletonTable: React.FC = () => (
  <div data-testid="admin-users-skeleton" role="status" aria-live="polite" aria-label="Loading users">
    <div style={{ ...cardStyle, padding: space[4] }}>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            gap: space[4],
            padding: `${space[3]} 0`,
            borderBottom: index < SKELETON_ROWS - 1 ? `1px solid ${colors.border}` : 'none',
          }}
        >
          <span style={{ ...skeletonBar, width: '28%' }} />
          <span style={{ ...skeletonBar, width: '30%' }} />
          <span style={{ ...skeletonBar, width: '12%' }} />
          <span style={{ ...skeletonBar, width: '14%' }} />
          <span style={{ ...skeletonBar, width: '10%' }} />
        </div>
      ))}
    </div>
  </div>
);

interface PendingChange {
  user: AdminUser;
  nextActive: boolean;
}

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchUsers(PAGE_LIMIT, 0)
      .then((data) => {
        if (!active) return;
        setUsers(data.items);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error, 'Unable to load users. Please try again.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError(null);
    fetchUsers(PAGE_LIMIT, 0)
      .then((data) => setUsers(data.items))
      .catch((error: unknown) =>
        setLoadError(errorMessage(error, 'Unable to load users. Please try again.'))
      )
      .finally(() => setIsLoading(false));
  };

  // Close the confirmation dialog with Escape unless a save is in flight.
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        setPending(null);
        setActionError(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending, isSaving]);

  const openConfirm = (target: AdminUser) => {
    setActionError(null);
    setPending({ user: target, nextActive: !target.isActive });
  };

  const closeConfirm = () => {
    if (isSaving) return;
    setPending(null);
    setActionError(null);
  };

  const confirmStatusChange = async () => {
    if (!pending) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await updateUserStatus(pending.user.id, pending.nextActive);
      setUsers((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      setPending(null);
    } catch (error) {
      setActionError(errorMessage(error, 'Unable to update this user. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
          User Account Administration
        </h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Manage platform users and access activation.
        </p>

        {loadError && <ErrorBanner message={loadError} onRetry={retryLoad} />}

        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? null : users.length === 0 ? (
          <div
            data-testid="admin-users-empty"
            style={{ ...cardStyle, padding: space[8], textAlign: 'center', color: colors.textMuted }}
          >
            No users found.
          </div>
        ) : (
          <div className="pt-admin-table-wrap" style={cardStyle}>
            <table className="pt-admin-table" aria-label="Platform users">
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>Name</th>
                  <th scope="col" style={thStyle}>Email</th>
                  <th scope="col" style={thStyle}>Role</th>
                  <th scope="col" style={thStyle}>Status</th>
                  <th scope="col" style={thStyle}>Created</th>
                  <th scope="col" style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = currentUser?.id === item.id;
                  return (
                    <tr key={item.id} data-testid={`user-row-${item.email}`}>
                      <td data-label="Name" style={tdStyle}>
                        <span style={{ fontWeight: font.weight.medium }}>{item.displayName}</span>
                        {isSelf && (
                          <span style={{ marginLeft: space[2], color: colors.textMuted, fontSize: font.size.xs }}>
                            (you)
                          </span>
                        )}
                      </td>
                      <td data-label="Email" style={tdStyle}>{item.email}</td>
                      <td data-label="Role" style={tdStyle}>{item.role}</td>
                      <td data-label="Status" style={tdStyle}>
                        <span
                          data-testid={`user-status-${item.email}`}
                          className={`pt-status-badge ${item.isActive ? 'pt-status-badge--active' : 'pt-status-badge--disabled'}`}
                        >
                          {item.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td data-label="Created" style={tdStyle}>{formatDate(item.createdAt)}</td>
                      <td data-label="Action" style={tdStyle}>
                        <span
                          title={isSelf ? 'You cannot disable your own account' : undefined}
                          style={{ display: 'inline-block' }}
                        >
                          <button
                            type="button"
                            data-testid={`toggle-${item.email}`}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot disable your own account' : undefined}
                            aria-label={
                              isSelf
                                ? 'You cannot disable your own account'
                                : `${item.isActive ? 'Disable' : 'Enable'} ${item.displayName}`
                            }
                            onClick={() => openConfirm(item)}
                            style={actionButtonStyle(!item.isActive, isSelf)}
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pending && (
        <div
          data-testid="confirm-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex.modal,
            backgroundColor: 'rgba(15, 30, 51, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: space[4],
          }}
          onClick={closeConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: colors.surfaceSolid,
              borderRadius: radius.xl,
              boxShadow: shadow.card,
              padding: space[6],
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-title" style={{ marginTop: 0, marginBottom: space[2], fontSize: font.size.lg }}>
              {pending.nextActive ? 'Enable' : 'Disable'} {pending.user.displayName}?
            </h3>
            <p style={{ marginTop: 0, marginBottom: space[5], color: colors.textSecondary, fontSize: font.size.sm }}>
              {pending.nextActive
                ? 'They will be able to sign in and start a new session again.'
                : 'This immediately signs them out of every active session and blocks further logins.'}
            </p>

            {actionError && (
              <div role="alert" className="pt-error-banner" style={{ marginBottom: space[4] }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={isSaving}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.porcelain,
                  color: colors.textPrimary,
                  fontWeight: font.weight.medium,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-status-change"
                onClick={() => void confirmStatusChange()}
                disabled={isSaving}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: radius.md,
                  border: 'none',
                  backgroundColor: colors.cobalt,
                  color: colors.porcelain,
                  fontWeight: font.weight.semibold,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
