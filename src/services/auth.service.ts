import { api, setToken, clearToken } from '../config/api';

export interface LoginResult {
  token: string;
}

export async function registerUser(email: string, password: string, displayName: string): Promise<void> {
  const { token } = await api.post<LoginResult>('/auth/register', { email, password, displayName });
  setToken(token);
  window.location.reload();
}

export async function loginUser(email: string, password: string): Promise<void> {
  const { token } = await api.post<LoginResult>('/auth/login', { email, password });
  setToken(token);
  window.location.reload();
}

export async function loginWithGoogle(idToken: string): Promise<void> {
  const { token } = await api.post<LoginResult>('/auth/google', { idToken });
  setToken(token);
  window.location.reload();
}

export async function logoutUser(): Promise<void> {
  clearToken();
  localStorage.removeItem("kistle_gate");
  window.location.reload();
}

// Der Server meldet beim Passwortwechsel alle Geräte ab und gibt diesem ein neues Token
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { token } = await api.post<{ token?: string }>('/auth/change-password', { currentPassword, newPassword });
  if (token) setToken(token);
}

export async function deleteAccount(currentPassword: string): Promise<void> {
  await api.delete('/auth/account', { password: currentPassword });
  clearToken();
  window.location.reload();
}

export async function handleOAuthRedirect(): Promise<void> {}
