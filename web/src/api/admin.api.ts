import { handleResponse } from './http';
import { AdminUser, AdminUserResponse, AdminUsersResponse } from '../types/admin.types';

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
