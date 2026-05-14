import React, { CSSProperties, useState, useEffect } from "react";
import { User, Bell, Moon, ChevronRight, LogOut } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { logoutUser } from "../services/auth.service";
import { isNotificationSupported, requestNotificationPermission, getNotificationsEnabled, setNotificationsEnabled } from "../services/notifications.service";

interface RowProps {
  icon: React.ElementType;
  label: string;
  value?: string;
  toggle?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  last?: boolean;
}

function Row({ icon: Icon, label, value, toggle, onToggle, onClick, last }: RowProps): React.ReactElement {
  return (
    <button
      style={{ ...styles.row, borderBottom: last ? "none" : "1px solid var(--c-border-2)" }}
      onClick={onClick ?? onToggle}
    >
      <div style={styles.rowIcon}>
        <Icon size={17} color="#f97316" />
      </div>
      <div style={styles.rowContent}>
        <span style={styles.rowLabel}>{label}</span>
        {value !== undefined && <span style={styles.rowValue}>{value}</span>}
      </div>
      {toggle !== undefined ? (
        <div style={{ ...styles.toggle, background: toggle ? "#f97316" : "var(--c-surface-2)" }}>
          <div style={{ ...styles.toggleThumb, transform: toggle ? "translateX(18px)" : "translateX(0)" }} />
        </div>
      ) : (
        <ChevronRight size={16} color="var(--c-text-4)" />
      )}
    </button>
  );
}

export default function Settings({ navigate: _navigate }: { navigate: NavigateFn }): React.ReactElement {
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifDenied, setNotifDenied]   = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    setNotifDenied(Notification.permission === "denied");
    setNotifEnabled(Notification.permission === "granted" && getNotificationsEnabled());
  }, []);

  const handleNotifToggle = async () => {
    if (!isNotificationSupported() || notifDenied) return;
    if (!notifEnabled) {
      if (Notification.permission !== "granted") {
        const result = await requestNotificationPermission();
        if (result !== "granted") { setNotifDenied(result === "denied"); return; }
      }
      setNotificationsEnabled(true);
      setNotifEnabled(true);
    } else {
      setNotificationsEnabled(false);
      setNotifEnabled(false);
    }
  };

  const displayName = user?.displayName ?? user?.email ?? "Unbekannt";
  const email       = user?.email ?? "";
  const initials    = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Settings</h1>
      <p style={styles.subtitle}>Konto und App-Einstellungen</p>

      {/* Profil-Karte */}
      <div style={styles.profileCard}>
        <div style={styles.profileAvatar}>{initials}</div>
        <div>
          <div style={styles.profileName}>{displayName}</div>
          <div style={styles.profileEmail}>{email}</div>
        </div>
      </div>

      {/* Konto */}
      <div style={styles.sectionLabel}>KONTO</div>
      <div style={styles.section}>
        <Row icon={User} label="E-Mail" value={email} last />
      </div>

      {/* App */}
      <div style={styles.sectionLabel}>APP</div>
      <div style={styles.section}>
        <Row
          icon={Bell}
          label="Benachrichtigungen"
          value={notifDenied ? "Im Browser blockiert" : undefined}
          toggle={notifDenied ? undefined : notifEnabled}
          onToggle={handleNotifToggle}
          last={false}
        />
        <Row
          icon={Moon}
          label="Dark Mode"
          toggle={isDark}
          onToggle={toggle}
          last
        />
      </div>

      {/* Abmelden */}
      <button style={styles.logoutBtn} onClick={logoutUser}>
        <LogOut size={16} color="#ef4444" />
        Abmelden
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px" },
  title:    { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 20 },
  profileCard: {
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    borderRadius: 18, padding: "20px",
    display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: "50%",
    background: "rgba(255,255,255,0.2)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 800, flexShrink: 0,
  },
  profileName:  { fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 2 },
  profileEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 8, marginTop: 4 },
  section: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 20 },
  row: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 16px", background: "none",
    border: "none", cursor: "pointer", width: "100%", textAlign: "left",
  },
  rowIcon:    { width: 34, height: 34, background: "var(--c-accent-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowContent: { flex: 1 },
  rowLabel:   { fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", display: "block" },
  rowValue:   { fontSize: 12, color: "var(--c-text-3)", marginTop: 1, display: "block" },
  toggle:     { width: 42, height: 24, borderRadius: 12, position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" },
  toggleThumb: {
    position: "absolute", top: 3, left: 3,
    width: 18, height: 18, borderRadius: "50%",
    background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
  },
  logoutBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "var(--c-surface)", border: "none", borderRadius: 14,
    padding: "14px 20px", fontSize: 14, fontWeight: 600,
    color: "#ef4444", cursor: "pointer", width: "100%",
  },
};
