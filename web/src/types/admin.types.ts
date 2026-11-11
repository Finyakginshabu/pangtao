import { Role } from './auth.types';

/** AC-02.1: the only fields the Admin API exposes for a user. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserResponse {
  user: AdminUser;
}
