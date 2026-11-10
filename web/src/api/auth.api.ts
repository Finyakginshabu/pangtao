import { User, AuthResponse, ApiErrorResponse } from '../types/auth.types';

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

export async function loginUser(email: string, password: string): Promise<User> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse<AuthResponse>(res);
  return data.user;
}

export async function logoutUser(): Promise<void> {
  const res = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  await handleResponse<void>(res);
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch('/api/v1/auth/me', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await handleResponse<AuthResponse>(res);
  return data.user;
}
