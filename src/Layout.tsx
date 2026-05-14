import React, { CSSProperties } from "react";
import { MapPin, Users, ShoppingCart, Search, Settings, Package } from "lucide-react";
import type { NavigateFn, PageName } from "./App";
import { useAuth } from "./contexts/AuthContext";
import { useCart } from "./contexts/CartContext";

interface NavItem {
  name: string;
  icon: React.ElementType;
  page: PageName;
  label: string;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  { name: "Places",    icon: MapPin,       page: "Places",     label: "Places" },
  { name: "Gruppen",   icon: Users,        page: "Groups",     label: "Gruppen" },
  { name: "Warenkorb", icon: ShoppingCart, page: "Cart",       label: "Warenkorb", highlight: true },
  { name: "Suche",     icon: Search,       page: "SearchPage", label: "Suche" },
  { name: "Settings",  icon: Settings,     page: "Settings",   label: "Settings" },
];

interface LayoutProps {
  children: React.ReactNode;
  currentPageName: PageName;
  navigate: NavigateFn;
}

export default function Layout({ children, currentPageName, navigate }: LayoutProps): React.ReactElement {
  const { user } = useAuth();
  const { items } = useCart();
  const cartCount = items.length;


  const userInitials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email ?? "?")[0].toUpperCase();

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <button style={styles.logoBtn} onClick={() => navigate("Dashboard")}>
          <div style={styles.logoIcon}>
            <Package size={20} color="#fff" />
          </div>
          <span style={styles.logoText}>Kistle</span>
        </button>
        <div style={styles.headerRight}>
          <button style={styles.avatar} onClick={() => navigate("Settings")}>
            {userInitials}
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={styles.main}>{children}</main>

      {/* Bottom Nav */}
      <nav style={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPageName === item.page ||
            (item.page === "Places" && (currentPageName === "PlaceDetail" || currentPageName === "BoxDetail"));

          if (item.highlight) {
            return (
              <button key={item.name} onClick={() => navigate(item.page)} style={styles.navHighlight}>
                <div style={styles.navHighlightInner}>
                  <Icon size={22} color="#fff" />
                  {cartCount > 0 && <span style={styles.badge} />}
                </div>
                <span style={styles.navHighlightLabel}>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.page)}
              style={{
                ...styles.navItem,
                color: isActive ? "#f97316" : "var(--c-text-3)",
                background: isActive ? "rgba(249,115,22,0.09)" : "none",
              }}
            >
              <Icon size={20} />
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex", flexDirection: "column",
    height: "100vh", maxWidth: 430, margin: "0 auto",
    background: "var(--c-bg)",
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    position: "relative", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px", background: "var(--c-surface)",
    borderBottom: "1px solid var(--c-border-2)",
    boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
    flexShrink: 0,
  },
  logoBtn: { display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 },
  logoIcon: {
    width: 34, height: 34,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
  },
  logoText: { fontSize: 17, fontWeight: 700, color: "var(--c-text-1)", letterSpacing: "-0.3px" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" },
  avatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(249,115,22,0.25)",
  },
  main: { flex: 1, overflowY: "auto", padding: "0 0 16px 0" },
  nav: {
    display: "flex", alignItems: "flex-end", justifyContent: "space-around",
    background: "var(--c-surface)", borderTop: "1px solid var(--c-border-2)",
    padding: "8px 4px 20px", flexShrink: 0,
    boxShadow: "0 -1px 8px rgba(0,0,0,0.04)",
  },
  navItem: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    background: "none", border: "none", cursor: "pointer",
    padding: "6px 14px", borderRadius: 12,
    transition: "background 0.15s, color 0.15s",
    position: "relative",
  },
  navLabel: { fontSize: 10, fontWeight: 600, letterSpacing: "0.2px" },
  activeDot: { display: "none" },
  navHighlight: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "none", border: "none", cursor: "pointer", padding: "0 8px", marginTop: -24,
  },
  navHighlightInner: {
    width: 56, height: 56, borderRadius: "50%",
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 6px 20px rgba(249,115,22,0.45)", position: "relative",
  },
  badge: {
    position: "absolute", top: 2, right: 2,
    background: "#ef4444",
    width: 10, height: 10, borderRadius: "50%",
    border: "2px solid var(--c-surface)",
  },
  navHighlightLabel: { fontSize: 10, fontWeight: 600, color: "#f97316" },
};
