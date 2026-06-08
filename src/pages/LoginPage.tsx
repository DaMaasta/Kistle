import React, { useState } from "react";
import type { CSSProperties } from "react";
import { useGoogleLogin } from "@react-oauth/google";
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

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        // tokenResponse.access_token → wir tauschen ihn gegen Nutzer-Info und senden ihn ans Backend
        // Das Backend erwartet ein ID-Token — wir nutzen den access_token um userinfo abzufragen
        await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        
        // Wir senden den access_token als "idToken" — Backend muss entsprechend tokeninfo endpoint nutzen
        await loginWithGoogle(tokenResponse.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google-Anmeldung fehlgeschlagen");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError("Google-Anmeldung fehlgeschlagen"),
  });

  const handleGoogle = () => {
    setError("");
    googleLogin();
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
        <button style={{ ...styles.googleBtn, opacity: googleLoading ? 0.7 : 1 }} onClick={handleGoogle} disabled={googleLoading} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {googleLoading ? "Lädt…" : "Mit Google anmelden"}
        </button>

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
    boxShadow: "var(--neu-raised-lg)",
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
    background: "var(--c-bg)", boxShadow: "var(--neu-inset-sm)",
  },
  error: {
    background: "var(--c-bg)", borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", wordBreak: "break-word",
    boxShadow: "var(--neu-inset-sm)",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    color: "#fff", border: "none", borderRadius: 12,
    padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer",
    marginTop: 4,
  },
  fieldHint: { fontSize: 11, color: "var(--c-text-3)", marginTop: 2 },
  switchRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 },
  switchText: { fontSize: 13, color: "var(--c-text-3)" },
  switchBtn: { background: "none", border: "none", color: "#FF7648", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  googleBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--c-bg)", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", cursor: "pointer", width: "100%", boxShadow: "var(--neu-raised-sm)" },
  divider: { display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0" },
  dividerText: { fontSize: 12, color: "var(--c-text-3)", whiteSpace: "nowrap" as const },
};
