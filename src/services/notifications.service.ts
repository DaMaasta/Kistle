const LS_KEY = "kistle_notifications_enabled";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationsEnabled(): boolean {
  return localStorage.getItem(LS_KEY) === "true";
}

export function setNotificationsEnabled(val: boolean): void {
  localStorage.setItem(LS_KEY, val ? "true" : "false");
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

export function showBookingNotification(itemCount: number, totalQty: number): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;
  if (!getNotificationsEnabled()) return;
  new Notification("Kistle – Abbuchung erfolgreich", {
    body: `${itemCount} Artikel (${totalQty} Stück) wurden aus den Boxen abgebucht.`,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  });
}
