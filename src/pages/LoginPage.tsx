import React, { useState, CSSProperties } from "react";
import { Package, AlertTriangle, X } from "lucide-react";
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
  const [showSetupHint, setShowSetupHint] = useState(false);

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
      } else if (msg.includes("configuration-not-found") || msg.includes("auth/configuration-not-found")) {
        setShowSetupHint(true);
      } else if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("E-Mail oder Passwort falsch.");
      } else if (msg.includes("email-already-in-use")) {
        setError("Diese E-Mail-Adresse ist bereits registriert.");
      } else if (msg.includes("weak-password")) {
        setError("Passwort muss mindestens 6 Zeichen haben.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) return;
      if (msg.includes("configuration-not-found")) { setShowSetupHint(true); return; }
      setError("Google-Anmeldung fehlgeschlagen.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={styles.root}>

      {/* Setup-Hinweis Modal */}
      {showSetupHint && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <AlertTriangle size={22} color="#f59e0b" />
              <span style={styles.modalTitle}>Firebase Authentication nicht aktiviert</span>
              <button style={styles.modalClose} onClick={() => setShowSetupHint(false)}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>
            <p style={styles.modalText}>
              Die Anmeldung ist noch nicht eingerichtet. Aktiviere <strong>Email/Passwort</strong> in der Firebase Console:
            </p>
            <ol style={styles.modalSteps}>
              <li>Öffne <strong>console.firebase.google.com</strong></li>
              <li>Wähle dein Projekt <strong>lagerapp-61b48</strong></li>
              <li>Gehe zu <strong>Authentication → Sign-in method</strong></li>
              <li>Aktiviere <strong>E-Mail/Passwort</strong></li>
              <li>Speichern – dann hier erneut versuchen</li>
            </ol>
            <button style={styles.modalBtn} onClick={() => { setShowSetupHint(false); setMode("register"); }}>
              Zur Registrierung
            </button>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}><Package size={22} color="#fff" /></div>
          <span style={styles.logoText}>Kistle</span>
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
              required
            />
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
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  logoIcon: {
    width: 38, height: 38,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    borderRadius: 11,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  title: { fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" },
  subtitle: { fontSize: 14, color: "#94a3b8", margin: "0 0 24px" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#475569" },
  input: {
    border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px",
    fontSize: 14, color: "#0f172a", outline: "none",
    transition: "border-color 0.15s",
  },
  error: {
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "#dc2626",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff", border: "none", borderRadius: 12,
    padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer",
    marginTop: 4,
  },
  switchRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 },
  switchText: { fontSize: 13, color: "#94a3b8" },
  switchBtn: { background: "none", border: "none", color: "#f97316", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  googleBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer", width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  divider: { display: "flex", alignItems: "center", gap: 0, margin: "4px 0", borderTop: "1px solid #e2e8f0" },
  dividerText: { fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" as const, background: "#fff", padding: "0 8px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modalCard: { background: "#fff", borderRadius: 20, padding: "24px", width: "100%", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: 14 },
  modalHeader: { display: "flex", alignItems: "center", gap: 10 },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: 700, color: "#0f172a" },
  modalClose: { background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" },
  modalText: { fontSize: 13, color: "#475569", lineHeight: 1.5, margin: 0 },
  modalSteps: { fontSize: 13, color: "#475569", lineHeight: 2, margin: 0, paddingLeft: 18 },
  modalBtn: { background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 },
};
