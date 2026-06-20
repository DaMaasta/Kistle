import React, { useState, useRef } from "react";
import type { CSSProperties } from "react";

// ─── Zugangscode hier eintragen ───────────────────────────────────────────────
const ACCESS_CODE = "b1b37316";
// ─────────────────────────────────────────────────────────────────────────────

interface WelcomePageProps {
  onSuccess: () => void;
}

export default function WelcomePage({ onSuccess }: WelcomePageProps): React.ReactElement {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8);
    setValue(clean);
    setError(false);
  };

  const handleSubmit = () => {
    if (value === ACCESS_CODE) {
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setValue("");
      inputRef.current?.focus();
    }
  };

  const digits = value.split("").concat(Array(8 - value.length).fill(""));

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <img src="/logo-v3.svg" alt="Kistle" style={styles.logoIcon} />
        </div>

        <h1 style={styles.title}>Willkommen bei Kistle</h1>
        <p style={styles.subtitle}>Gib den 8-stelligen Zugangscode ein.</p>

        {/* Verstecktes echtes Input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={handleChange}
          onKeyDown={e => { if (e.key === "Enter" && value.length === 8) handleSubmit(); }}
          style={styles.hiddenInput}
          autoFocus
        />

        {/* Visuelle Boxen */}
        <div
          style={{ ...styles.codeRow, animation: shake ? "shake 0.45s ease" : "none" }}
          onClick={() => inputRef.current?.focus()}
        >
          {digits.map((d, i) => (
            <React.Fragment key={i}>
              {i === 4 && <div style={styles.codeSep} />}
              <div style={{
                ...styles.digitBox,
                borderColor: error ? "#ef4444" : d ? "#2C2926" : "var(--c-border)",
                background: d ? "var(--c-surface)" : "#fff",
                boxShadow: value.length === i ? "0 0 0 2px #2C2926" : "none",
              }}>
                {d}
              </div>
            </React.Fragment>
          ))}
        </div>

        {error && <p style={styles.error}>Falscher Code. Versuche es erneut.</p>}

        <button
          style={{ ...styles.btn, opacity: value.length === 8 ? 1 : 0.4 }}
          onClick={handleSubmit}
          disabled={value.length < 8}
        >
          Weiter
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          35%       { transform: translateX(8px); }
          55%       { transform: translateX(-6px); }
          75%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: "100svh",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--c-bg)", padding: 16,
  },
  card: {
    background: "var(--c-surface)", borderRadius: 24,
    padding: "36px 20px", width: "100%", maxWidth: 400,
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  logoRow: { marginBottom: 28 },
  logoIcon: { width: 60, height: 60, borderRadius: 18, display: "block" },
  title: { fontSize: 22, fontWeight: 800, color: "var(--c-text-1)", margin: "0 0 8px", textAlign: "center" },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", margin: "0 0 28px", textAlign: "center" },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: "none",
  },
  codeRow: {
    display: "flex", alignItems: "center", gap: 5,
    marginBottom: 8, cursor: "text",
  },
  codeSep: {
    width: 8, height: 2, borderRadius: 1,
    background: "var(--c-border)", flexShrink: 0,
  },
  digitBox: {
    width: 32, height: 42, borderRadius: 8,
    border: "1.5px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 17, fontWeight: 800, color: "var(--c-text-1)",
    transition: "border-color 0.15s, box-shadow 0.15s",
    userSelect: "none",
    flexShrink: 0,
  },
  error: {
    fontSize: 13, color: "#ef4444",
    margin: "8px 0 0", textAlign: "center",
  },
  btn: {
    marginTop: 24, width: "100%",
    background: "#2C2926", color: "#fff",
    border: "none", borderRadius: 12,
    padding: "14px 0", fontSize: 16, fontWeight: 700,
    cursor: "pointer", transition: "opacity 0.15s",
  },
};
