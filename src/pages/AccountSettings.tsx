import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { changePassword, deleteAccount } from "../services/auth.service";
import { useHeader } from "../contexts/HeaderContext";

interface AccountSettingsProps {
  navigate: NavigateFn;
}

function mapError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Aktuelles Passwort ist falsch.";
  if (code === "auth/weak-password") return "Neues Passwort zu schwach (mind. 6 Zeichen).";
  if (code === "auth/requires-recent-login") return "Bitte melde dich erneut an und versuche es nochmal.";
  return e instanceof Error ? e.message : "Unbekannter Fehler.";
}

export default function AccountSettings({ navigate }: AccountSettingsProps): React.ReactElement {
  const { user } = useAuth();
  const { setHeader, clearHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: "Konto", onBack: () => navigate("Settings") });
    return () => clearHeader();
  }, []);

  const isEmailUser = false;

  // password change
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCur,        setShowCur]        = useState(false);
  const [showNew,        setShowNew]        = useState(false);
  const [showConfirmPw,  setShowConfirmPw]  = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwError,    setPwError]    = useState<string | null>(null);
  const [pwSuccess,  setPwSuccess]  = useState(false);

  // account deletion
  const [deletePw,   setDeletePw]   = useState("");
  const [showDel,    setShowDel]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [delError,   setDelError]   = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (!newPw || !currentPw) { setPwError("Bitte alle Felder ausfüllen."); return; }
    if (newPw !== confirmPw)  { setPwError("Neue Passwörter stimmen nicht überein."); return; }
    if (newPw.length < 6)     { setPwError("Neues Passwort zu kurz (mind. 6 Zeichen)."); return; }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setPwError(mapError(e));
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDelError(null);
    setDeleting(true);
    try {
      await deleteAccount(deletePw);
      // auth state change logs user out automatically
    } catch (e) {
      setDelError(mapError(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Konto</h1>
      <p style={styles.subtitle}>{user?.email}</p>

      {/* Passwort ändern */}
      {isEmailUser && (
        <>
          <div style={styles.sectionLabel}>PASSWORT ÄNDERN</div>
          <div style={styles.card}>
            <PasswordInput
              label="Aktuelles Passwort"
              value={currentPw}
              onChange={setCurrentPw}
              show={showCur}
              onToggle={() => setShowCur((v) => !v)}
            />
            <div style={styles.divider} />
            <PasswordInput
              label="Neues Passwort"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
            />
            <div style={styles.divider} />
            <PasswordInput
              label="Neues Passwort bestätigen"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showConfirmPw}
              onToggle={() => setShowConfirmPw((v) => !v)}
            />
          </div>

          {pwError   && <div style={styles.errorBox}>{pwError}</div>}
          {pwSuccess && <div style={styles.successBox}>Passwort erfolgreich geändert.</div>}

          <button
            style={{ ...styles.saveBtn, opacity: pwSaving ? 0.7 : 1 }}
            onClick={handleChangePassword}
            disabled={pwSaving}
          >
            {pwSaving ? "Wird gespeichert…" : "Passwort ändern"}
          </button>
        </>
      )}

      {!isEmailUser && (
        <div style={styles.infoBox}>
          Du bist mit Google angemeldet – das Passwort wird über dein Google-Konto verwaltet.
        </div>
      )}

      {/* Konto löschen */}
      <div style={{ ...styles.sectionLabel, marginTop: 28 }}>KONTO LÖSCHEN</div>
      <div style={styles.dangerCard}>
        <Trash2 size={18} color="#ef4444" />
        <div style={styles.dangerText}>
          <span style={styles.dangerTitle}>Konto dauerhaft löschen</span>
          <span style={styles.dangerHint}>Alle Daten werden unwiderruflich gelöscht.</span>
        </div>
        {!showConfirm && (
          <button style={styles.dangerBtn} onClick={() => setShowConfirm(true)}>
            Löschen
          </button>
        )}
      </div>

      {showConfirm && (
        <div style={styles.confirmBox}>
          <p style={styles.confirmText}>
            Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          {isEmailUser && (
            <PasswordInput
              label="Passwort zur Bestätigung"
              value={deletePw}
              onChange={setDeletePw}
              show={showDel}
              onToggle={() => setShowDel((v) => !v)}
            />
          )}
          {delError && <div style={{ ...styles.errorBox, marginTop: 10 }}>{delError}</div>}
          <div style={styles.confirmBtns}>
            <button
              style={{ ...styles.confirmDeleteBtn, opacity: deleting ? 0.7 : 1 }}
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? "Wird gelöscht…" : "Ja, Konto löschen"}
            </button>
            <button style={styles.cancelBtn} onClick={() => { setShowConfirm(false); setDelError(null); }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}

function PasswordInput({ label, value, onChange, show, onToggle }: PasswordInputProps): React.ReactElement {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <div style={styles.inputRow}>
        <input
          type={show ? "text" : "password"}
          style={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <button style={styles.eyeBtn} onClick={onToggle} type="button">
          {show ? <EyeOff size={16} color="var(--c-text-3)" /> : <Eye size={16} color="var(--c-text-3)" />}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back:      { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: 20 },
  backText:  { color: "#FF7648", fontSize: 14, fontWeight: 600 },
  title:     { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: "0 0 2px" },
  subtitle:  { fontSize: 13, color: "var(--c-text-3)", marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.08em", marginBottom: 8 },
  card: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 12 },
  divider: { height: 1, background: "var(--c-border-2)", marginLeft: 16 },
  field: { display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px" },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" },
  inputRow: { display: "flex", alignItems: "center", gap: 8 },
  input: { flex: 1, border: "none", outline: "none", fontSize: 16, color: "var(--c-text-1)", background: "transparent", padding: "2px 0" },
  eyeBtn: { background: "none", border: "none", cursor: "pointer", padding: 10, display: "flex", alignItems: "center", flexShrink: 0, minWidth: 44, minHeight: 44, justifyContent: "center" },
  saveBtn: {
    width: "100%", padding: "14px", border: "none", borderRadius: 14,
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
  },
  errorBox:   { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 10 },
  successBox: { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#15803d", marginBottom: 10 },
  infoBox:    { background: "var(--c-surface-2)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "var(--c-text-3)", marginBottom: 8 },
  dangerCard: {
    display: "flex", alignItems: "center", gap: 12,
    background: "var(--c-surface)", border: "1px solid #fca5a5",
    borderRadius: 14, padding: "14px 16px", marginBottom: 12,
  },
  dangerText:  { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  dangerTitle: { fontSize: 14, fontWeight: 600, color: "#ef4444" },
  dangerHint:  { fontSize: 12, color: "var(--c-text-3)" },
  dangerBtn:   { background: "#ef4444", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", flexShrink: 0 },
  confirmBox:  { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  confirmText: { fontSize: 14, color: "#7f1d1d", fontWeight: 500, margin: 0 },
  confirmBtns: { display: "flex", gap: 10 },
  confirmDeleteBtn: { flex: 1, background: "#ef4444", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
  cancelBtn:        { flex: 1, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer" },
};
