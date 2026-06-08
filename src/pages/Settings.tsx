declare const __APP_VERSION__: string;
import React from "react";
import type { CSSProperties } from "react";
import { User, ChevronRight, LogOut, Puzzle } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { logoutUser } from "../services/auth.service";

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
        <Icon size={17} color="#FF7648" />
      </div>
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

export default function Settings({ navigate }: { navigate: NavigateFn }): React.ReactElement {
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email ?? "";
  const email = user?.email ?? "";
  const [logoutConfirm, setLogoutConfirm] = React.useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.profileHeader}>
        <div style={styles.profileName}>{displayName}</div>
      </div>

      {/* Konto */}
      <div style={styles.sectionLabel}>KONTO</div>
      <div style={styles.section}>
        <Row icon={User} label="E-Mail" value={email} onClick={() => navigate("AccountSettings")} last />
      </div>

      {/* Erweiterungen */}
      <div style={styles.sectionLabel}>ERWEITERUNGEN</div>
      <div style={styles.section}>
        <Row icon={Puzzle} label="Erweiterungen" onClick={() => navigate("Erweiterungen")} last />
      </div>

      {/* Abmelden */}
      {!logoutConfirm ? (
        <button style={styles.logoutBtn} onClick={() => setLogoutConfirm(true)}>
          <LogOut size={16} color="#ef4444" />
          Abmelden
        </button>
      ) : (
        <div style={styles.logoutConfirm}>
          <span style={styles.logoutConfirmText}>Wirklich abmelden?</span>
          <button style={styles.logoutConfirmYes} onClick={logoutUser}>Ja</button>
          <button style={styles.logoutConfirmNo} onClick={() => setLogoutConfirm(false)}>Nein</button>
        </div>
      )}

      <p style={styles.version}>Version {__APP_VERSION__}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px", height: "100%", overflowY: "auto" as const },
  profileHeader: { marginBottom: 24 },
  profileName: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)" },
  title:    { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 20 },
  profileCard: {
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    borderRadius: 18, padding: "20px",
    display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: "50%",
    background: "rgba(255,255,255,0.2)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 800, flexShrink: 0,
  },
  profileAvatarImg: {
    width: 56, height: 56, borderRadius: "50%",
    objectFit: "cover" as const, flexShrink: 0,
    border: "2px solid rgba(255,255,255,0.4)",
  },
  profileEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 8, marginTop: 4 },
  section: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--neu-raised-sm)", marginBottom: 20 },
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
  version: { fontSize: 11, color: "var(--c-text-4)", textAlign: "center", marginTop: 16, marginBottom: 4 },
  logoutBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "var(--c-surface)", border: "none", borderRadius: 14,
    padding: "14px 20px", fontSize: 14, fontWeight: 600,
    color: "#ef4444", cursor: "pointer", width: "100%",
  },
  logoutConfirm: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--c-surface)", borderRadius: 14, padding: "12px 16px",
  },
  logoutConfirmText: { flex: 1, fontSize: 14, fontWeight: 600, color: "#ef4444" },
  logoutConfirmYes:  { background: "#ef4444", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
  logoutConfirmNo:   { background: "var(--c-surface-2)", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer" },
};
