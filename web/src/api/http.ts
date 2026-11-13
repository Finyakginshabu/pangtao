import { ApiErrorResponse } from '../types/auth.types';

/** Parses a JSON response; on failure throws the server's error envelope (or a network-shaped one). */
export async function handleResponse<T>(res: Response): Promise<T> {
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

/** Reads the message from a thrown error envelope, with a fallback for anything else. */
export function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as Partial<ApiErrorResponse> | undefined;
  return candidate?.error?.message ?? fallback;
}

export function errorCode(error: unknown): string | undefined {
  return (error as Partial<ApiErrorResponse> | undefined)?.error?.code;
}
