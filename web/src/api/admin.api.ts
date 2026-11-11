import { ApiErrorResponse } from '../types/auth.types';
import { AdminUser, AdminUserResponse, AdminUsersResponse } from '../types/admin.types';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await res.json();
    } catch {
      errorData = {
        error: {
          code: 'NETWORK_ERROR',
          message: 'An unexpected network error occurred.',
        },
      };
    }
    throw errorData;
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export async function fetchUsers(limit = 50, offset = 0): Promise<AdminUsersResponse> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`/api/v1/admin/users?${query.toString()}`, {
    credentials: 'include',
  });
  return handleResponse<AdminUsersResponse>(res);
}

export async function updateUserStatus(id: string, isActive: boolean): Promise<AdminUser> {
  const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });
  const data = await handleResponse<AdminUserResponse>(res);
  return data.user;
}
