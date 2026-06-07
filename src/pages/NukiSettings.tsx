import React, { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, LockOpen, Lock } from "lucide-react";
import type { NavigateFn } from "../App";
import { publishUnlock, publishLock } from "../services/mqtt.service";

type NukiState = "idle" | "confirm" | "loading" | "success" | "error";

export default function NukiSettings({ navigate }: { navigate: NavigateFn }): React.ReactElement {
  const [unlockState, setUnlockState] = useState<NukiState>("idle");
  const [lockState,   setLockState]   = useState<NukiState>("idle");

  const run = async (action: () => Promise<void>, setState: (s: NukiState) => void) => {
    setState("loading");
    try {
      await action();
      setState("success");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  };

  const renderActionRow = (
    state: NukiState,
    setState: (s: NukiState) => void,
    action: () => Promise<void>,
    icon: React.ReactElement,
    label: string,
    subTexts: { loading: string; success: string; error: string; idle: string },
    borderBottom?: boolean,
  ) => {
    if (state === "confirm") {
      return (
        <div style={{ ...styles.actionRow, ...(borderBottom ? { borderBottom: "1px solid var(--c-border-2)" } : {}) }}>
          <div style={styles.info}>
            <span style={styles.label}>{label} — Bestätigen?</span>
          </div>
          <button style={styles.confirmYes} onClick={() => run(action, setState)}>Ja</button>
          <button style={styles.confirmNo} onClick={() => setState("idle")}>Nein</button>
        </div>
      );
    }
    const stateColor = state === "success" ? "#16a34a" : state === "error" ? "#dc2626" : "#f97316";
    const stateBg    = state === "success" ? "#dcfce7" : state === "error" ? "#fee2e2" : "var(--c-accent-bg)";
    return (
      <button
        style={{ ...styles.actionRow, ...(borderBottom ? { borderBottom: "1px solid var(--c-border-2)" } : {}), opacity: state === "loading" ? 0.6 : 1 }}
        onClick={() => setState("confirm")}
        disabled={state === "loading"}
      >
        <div style={{ ...styles.iconBox, background: stateBg }}>
          {React.cloneElement(icon, { color: stateColor } as React.HTMLAttributes<SVGElement>)}
        </div>
        <div style={styles.info}>
          <span style={styles.label}>{label}</span>
          <span style={styles.sub}>
            {state === "loading" ? subTexts.loading : state === "success" ? subTexts.success : state === "error" ? subTexts.error : subTexts.idle}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div style={styles.container}>
      <button style={styles.back} onClick={() => navigate("Erweiterungen")}>
        <ChevronLeft size={20} color="#f97316" />
        <span style={styles.backLabel}>Erweiterungen</span>
      </button>

      <h1 style={styles.title}>Nuki Smart Lock</h1>
      <p style={styles.subtitle}>Schloss steuern</p>

      <div style={styles.section}>
        {renderActionRow(
          unlockState, setUnlockState, publishUnlock,
          <LockOpen size={18} />, "Tür öffnen",
          { loading: "Öffnet…", success: "Erfolgreich geöffnet ✓", error: "Fehler beim Öffnen", idle: "Nuki entriegeln" },
          true,
        )}
        {renderActionRow(
          lockState, setLockState, publishLock,
          <Lock size={18} />, "Tür sperren",
          { loading: "Sperrt…", success: "Erfolgreich gesperrt ✓", error: "Fehler beim Sperren", idle: "Nuki verriegeln" },
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px 16px", height: "100%", overflowY: "auto" as const },
  back:      { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "0 0 16px", color: "#f97316" },
  backLabel: { fontSize: 15, fontWeight: 600, color: "#f97316" },
  title:     { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle:  { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 24 },
  section:   { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  actionRow: { display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" as const },
  iconBox:   { width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" },
  info:      { flex: 1, display: "flex", flexDirection: "column" as const, gap: 2 },
  label:     { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" },
  sub:        { fontSize: 12, color: "var(--c-text-3)" },
  confirmYes: { background: "#f97316", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 },
  confirmNo:  { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer", flexShrink: 0 },
};
