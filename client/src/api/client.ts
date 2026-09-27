const API_BASE_URL = '/api';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('tpc_admin_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('tpc_admin_token');
      // Trigger re-render / auth change
      window.dispatchEvent(new Event('tpc_auth_logout'));
    }
    throw new ApiError(response.status, data.message || 'An error occurred during request.', data);
  }

  return data as T;
}
