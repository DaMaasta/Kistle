import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { ChevronRight, Bell, Moon, Lock } from "lucide-react";
import type { NavigateFn } from "../App";
import { useTheme } from "../contexts/ThemeContext";
import { useHeader } from "../contexts/HeaderContext";
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
      <div style={styles.rowIcon}><Icon size={17} color="#FF7648" /></div>
      <div style={styles.rowContent}>
        <span style={styles.rowLabel}>{label}</span>
        {value !== undefined && <span style={styles.rowValue}>{value}</span>}
      </div>
      {toggle !== undefined ? (
        <div style={{ ...styles.toggle, background: toggle ? "#FF7648" : "var(--c-surface-2)" }}>
          <div style={{ ...styles.toggleThumb, transform: toggle ? "translateX(18px)" : "translateX(0)" }} />
        </div>
      ) : (
        <ChevronRight size={16} color="var(--c-text-4)" />
      )}
    </button>
  );
}

export default function Erweiterungen({ navigate }: { navigate: NavigateFn }): React.ReactElement {
  const { isDark, toggle } = useTheme();
  const { setHeader, clearHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: "Erweiterungen", onBack: () => navigate("Settings") });
    return () => clearHeader();
  }, []);

  const [notifEnabled, setNotifEnabled] = useState(() =>
    isNotificationSupported() && Notification.permission === "granted" && getNotificationsEnabled()
  );
  const [notifDenied] = useState(() =>
    isNotificationSupported() && Notification.permission === "denied"
  );

  const handleNotifToggle = async () => {
    if (!isNotificationSupported() || notifDenied) return;
    if (!notifEnabled) {
      if (Notification.permission !== "granted") {
        const result = await requestNotificationPermission();
        if (!result) return;
      }
      setNotificationsEnabled(true);
      setNotifEnabled(true);
    } else {
      setNotificationsEnabled(false);
      setNotifEnabled(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Erweiterungen</h1>
      <p style={styles.subtitle}>App-Einstellungen & Integrationen</p>

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

      {/* Integrationen */}
      <div style={styles.sectionLabel}>INTEGRATIONEN</div>
      <div style={styles.section}>
        <Row
          icon={Lock}
          label="Nuki Smart Lock"
          value="Schloss steuern"
          onClick={() => navigate("NukiSettings")}
          last
        />
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container:   { padding: "16px 16px", height: "100%", overflowY: "auto" as const },
  back:        { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "0 0 16px", color: "#FF7648" },
  backLabel:   { fontSize: 15, fontWeight: 600, color: "#FF7648" },
  title:       { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle:    { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 24 },
  sectionLabel:{ fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 8 },
  section:     { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--neu-raised)", marginBottom: 20 },
  row:         { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" as const },
  rowIcon:     { width: 34, height: 34, background: "var(--c-accent-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowContent:  { flex: 1 },
  rowLabel:    { fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", display: "block" },
  rowValue:    { fontSize: 12, color: "var(--c-text-3)", marginTop: 1, display: "block" },
  toggle:      { width: 42, height: 24, borderRadius: 12, position: "relative" as const, transition: "background 0.2s", flexShrink: 0 },
  toggleThumb: { position: "absolute" as const, top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.2s" },
};
