import React, { useState } from "react";
import type { CSSProperties } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { loginUser, registerUser, loginWithGoogle } from "../services/auth.service";

type Mode = "login" | "register";

export default function LoginPage(): React.ReactElement {
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email, password);
      } else {
        if (!name.trim()) { setError("Bitte gib deinen Namen ein."); setLoading(false); return; }
        await registerUser(email, password, name.trim());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
        // user closed popup — no error needed
      } else if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("E-Mail oder Passwort falsch.");
      } else if (msg.includes("email-already-in-use")) {
        setError("Diese E-Mail-Adresse ist bereits registriert.");
      } else if (msg.includes("weak-password")) {
        setError("Passwort muss mindestens 6 Zeichen haben.");
      } else if (msg.includes("network-request-failed") || msg.includes("network")) {
        setError("Keine Internetverbindung. Bitte prüfe deine Verbindung.");
      } else if (msg.includes("too-many-requests")) {
        setError("Zu viele Versuche. Bitte warte kurz und versuche es erneut.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setGoogleLoading(true);
    setGoogleError("");
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Google-Anmeldung fehlgeschlagen");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={styles.root}>

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <img src="/logo-v3.svg" alt="Kistle" style={styles.logoIcon} />
        </div>

        <h1 style={styles.title}>{mode === "login" ? "Willkommen zurück" : "Konto erstellen"}</h1>
        <p style={styles.subtitle}>{mode === "login" ? "Melde dich an, um fortzufahren." : "Registriere dich kostenlos."}</p>

        {/* Google */}
        <div style={styles.googleWrapper}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setGoogleError("Google-Anmeldung fehlgeschlagen")}
            width="340"
            text="signin_with"
            shape="rectangular"
            theme="outline"
          />
          {googleLoading && <p style={styles.googleHint}>Anmeldung läuft…</p>}
          {googleError && <div style={styles.error}>{googleError}</div>}
        </div>

        <div style={styles.divider}><span style={styles.dividerText}>oder</span></div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "register" && (
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Dein Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                inputMode="text"
                required
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>E-Mail</label>
            <input
              style={styles.input}
              type="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Passwort</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {mode === "register" && (
              <span style={styles.fieldHint}>Mindestens 6 Zeichen</span>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Lädt…" : mode === "login" ? "Anmelden" : "Registrieren"}
          </button>
        </form>

        <div style={styles.switchRow}>
          <span style={styles.switchText}>
            {mode === "login" ? "Noch kein Konto?" : "Bereits registriert?"}
          </span>
          <button
            style={styles.switchBtn}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          >
            {mode === "login" ? "Registrieren" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--c-bg)",
    padding: 16,
  },
  card: {
    background: "var(--c-surface)",
    borderRadius: 24,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 400,
  },
  logoRow: { display: "flex", justifyContent: "center", marginBottom: 28 },
  logoIcon: { width: 52, height: 52, borderRadius: 15, display: "block" },
  title: { fontSize: 22, fontWeight: 800, color: "var(--c-text-1)", margin: "0 0 6px" },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", margin: "0 0 14px" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  input: {
    border: "none", borderRadius: 12, padding: "12px 14px",
    fontSize: 16, color: "var(--c-text-1)", outline: "none",
    background: "#ffffff",
  },
  error: {
    background: "#ffffff", borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", wordBreak: "break-word",
  },
  submitBtn: {
    background: "#2C2926",
    color: "#fff", border: "none", borderRadius: 12,
    padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer",
    marginTop: 4,
  },
  fieldHint: { fontSize: 11, color: "var(--c-text-3)", marginTop: 2 },
  switchRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 },
  switchText: { fontSize: 13, color: "var(--c-text-3)" },
  switchBtn: { background: "none", border: "none", color: "#2C2926", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  googleWrapper: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, width: "100%" },
  googleHint: { fontSize: 12, color: "var(--c-text-3)", margin: 0 },
  divider: { display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0" },
  dividerText: { fontSize: 12, color: "var(--c-text-3)", whiteSpace: "nowrap" as const },
};
