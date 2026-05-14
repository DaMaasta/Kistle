import React, { useState, useEffect, CSSProperties } from "react";
import { MapPin, Users, ChevronRight, type LucideIcon } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToUserSpaces } from "../services/spaces.service";
import type { Space } from "../types";

interface DashboardProps {
  navigate: NavigateFn;
}

interface WeatherData {
  temp: number;
  icon: string;
  desc: string;
  wind: number;
}

function wmoToInfo(code: number): { icon: string; desc: string } {
  if (code === 0)        return { icon: "☀️", desc: "Sonnig" };
  if (code <= 2)         return { icon: "🌤", desc: "Leicht bewölkt" };
  if (code === 3)        return { icon: "☁️", desc: "Bedeckt" };
  if (code <= 48)        return { icon: "🌫", desc: "Neblig" };
  if (code <= 57)        return { icon: "🌦", desc: "Nieselregen" };
  if (code <= 67)        return { icon: "🌧", desc: "Regen" };
  if (code <= 77)        return { icon: "🌨", desc: "Schnee" };
  if (code <= 82)        return { icon: "🌦", desc: "Schauer" };
  return                        { icon: "⛈", desc: "Gewitter" };
}

export default function Dashboard({ navigate }: DashboardProps): React.ReactElement {
  const { user } = useAuth();
  const [time, setTime]       = useState<Date>(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [spaces, setSpaces]   = useState<Space[]>([]);

  // Uhr
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Wetter: Open-Meteo, Niefern-Öschelbronn (48.965°N, 8.784°E)
  useEffect(() => {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=48.965&longitude=8.784" +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&timezone=Europe%2FBerlin";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const c = data.current;
        const info = wmoToInfo(c.weather_code as number);
        setWeather({
          temp: Math.round(c.temperature_2m as number),
          wind: Math.round(c.wind_speed_10m as number),
          ...info,
        });
      })
      .catch(() => {/* Wetter nicht verfügbar – kein Fehler anzeigen */});
  }, []);

  // Firebase Spaces
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserSpaces(user.uid, setSpaces);
    return unsubscribe;
  }, [user]);

  const myPlaces = spaces.filter((s) => !s.isGroup && s.parentId === null);
  const myGroups = spaces.filter((s) => s.isGroup);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d: Date) =>
    d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={styles.container}>
      {/* Uhr & Wetter */}
      <div style={styles.heroCard}>
        <div style={styles.clockText}>{formatTime(time)}</div>
        <div style={styles.dateText}>{formatDate(time)}</div>
        <div style={styles.weatherRow}>
          <div style={styles.weatherLeft}>
            <span style={styles.weatherIcon}>{weather ? weather.icon : "…"}</span>
            <div>
              <div style={styles.temp}>{weather ? `${weather.temp}°C` : "–"}</div>
              <div style={styles.weatherDesc}>{weather ? weather.desc : "Lädt…"}</div>
            </div>
          </div>
          <div style={styles.weatherRight}>
            <div style={styles.location}>📍 Niefern</div>
            <div style={styles.wind}>{weather ? `Wind ${weather.wind} km/h` : ""}</div>
          </div>
        </div>
      </div>

      {/* Meine Places */}
      <Section title="Meine Places" onShowAll={() => navigate("Places")}>
        {myPlaces.length === 0 ? (
          <div style={styles.emptySection}>Noch keine Places erstellt</div>
        ) : (
          myPlaces.slice(0, 3).map((s) => (
            <ListItem
              key={s.id}
              title={s.name}
              subtitle={s.description || s.type}
              onClick={() => navigate("PlaceDetail", { place: s })}
            />
          ))
        )}
      </Section>

      {/* Meine Gruppen */}
      <Section title="Meine Gruppen" onShowAll={() => navigate("Groups")}>
        {myGroups.length === 0 ? (
          <div style={styles.emptySection}>Noch keine geteilten Spaces</div>
        ) : (
          myGroups.slice(0, 3).map((s) => (
            <ListItem
              key={s.id}
              title={s.name}
              subtitle={`${s.memberIds.length} Mitglieder`}
              onClick={() => navigate("GroupDetail", { group: s })}
              icon={Users}
            />
          ))
        )}
      </Section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  emoji?: string;
  onShowAll: () => void;
  children: React.ReactNode;
}

function Section({ title, emoji, onShowAll, children }: SectionProps): React.ReactElement {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>
          {emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}
          {title}
        </span>
        <button style={styles.seeAll} onClick={onShowAll}>Alle anzeigen</button>
      </div>
      <div style={styles.card}>{children}</div>
    </div>
  );
}

interface ListItemProps {
  title: string;
  subtitle: string;
  onClick: () => void;
  icon?: LucideIcon;
}

function ListItem({ title, subtitle, onClick, icon: Icon = MapPin }: ListItemProps): React.ReactElement {
  return (
    <button style={styles.listItem} onClick={onClick}>
      <div style={styles.listIcon}>
        <Icon size={16} color="#f97316" />
      </div>
      <div style={styles.listContent}>
        <div style={styles.listTitle}>{title}</div>
        <div style={styles.listSubtitle}>{subtitle}</div>
      </div>
      <ChevronRight size={16} color="#cbd5e1" />
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  heroCard: {
    background: "linear-gradient(150deg, #fffbf7 0%, #ffffff 55%)",
    borderRadius: 22, padding: "24px 22px 18px",
    marginBottom: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
    borderLeft: "4px solid #f97316",
  },
  clockText: { fontSize: 50, fontWeight: 800, color: "#0f172a", letterSpacing: "-2px", lineHeight: 1 },
  dateText: { fontSize: 13, color: "#94a3b8", marginTop: 4, marginBottom: 18, fontWeight: 500 },
  weatherRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    paddingTop: 14, borderTop: "1px solid #f1f5f9",
  },
  weatherLeft: { display: "flex", alignItems: "center", gap: 12 },
  weatherIcon: { fontSize: 30 },
  temp: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  weatherDesc: { fontSize: 12, color: "#64748b" },
  weatherRight: { textAlign: "right" },
  location: { fontSize: 12, fontWeight: 600, color: "#0f172a" },
  wind: { fontSize: 11, color: "#94a3b8" },
  section: { marginBottom: 20 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" },
  seeAll: { background: "none", border: "none", cursor: "pointer", color: "#f97316", fontSize: 13, fontWeight: 600 },
  card: { background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  emptySection: { padding: "18px 16px", fontSize: 13, color: "#94a3b8", textAlign: "center" },
  listItem: {
    display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
    background: "none", border: "none", borderBottom: "1px solid var(--c-border-2)",
    cursor: "pointer", width: "100%", textAlign: "left",
    transition: "background 0.12s ease",
  },
  listIcon: {
    width: 40, height: 40, background: "#fff3e8", borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  listContent: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  listSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2, textTransform: "capitalize" },
};
