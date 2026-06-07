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
  window.location.reload();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

export async function deleteAccount(currentPassword: string): Promise<void> {
  await api.delete('/auth/account', { password: currentPassword });
  clearToken();
  window.location.reload();
}

export async function handleOAuthRedirect(): Promise<void> {}
