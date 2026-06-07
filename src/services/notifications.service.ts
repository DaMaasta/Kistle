import { api } from '../config/api';
import type { AppNotification } from '../types';

function deserializeNotif(n: AppNotification): AppNotification {
  return { ...n, createdAt: new Date(n.createdAt) };
}

export function subscribeToUnreadNotifications(
  _userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  let active = true;
  async function load() {
    const notifs = await api.get<AppNotification[]>('/notifications?unreadOnly=true');
    if (active) callback(notifs.map(deserializeNotif));
  }
  load();
  const interval = setInterval(load, 10000);
  return () => { active = false; clearInterval(interval); };
}

export async function markAllNotificationsRead(_userId: string): Promise<void> {
  await api.put('/notifications/read-all', {});
}

export async function createNotification(
  notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  await api.post('/notifications', notif);
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationsEnabled(): boolean {
  return localStorage.getItem('notificationsEnabled') === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem('notificationsEnabled', String(enabled));
}

export async function showBookingNotification(title: string, body: string): Promise<void> {
  if (getNotificationsEnabled() && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
