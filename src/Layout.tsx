import React, { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { FolderOpen, MapPin, ShoppingCart, Search, Settings, Bell, X, ChevronLeft } from "lucide-react";
import { getInitials } from "./utils/stringUtils";
import type { NavigateFn, PageName } from "./App";
import { useAuth } from "./contexts/AuthContext";
import { useCart } from "./contexts/CartContext";
import { useHeader } from "./contexts/HeaderContext";

import { subscribeToUnreadNotifications, markAllNotificationsRead } from "./services/notifications.service";
import type { AppNotification } from "./types";

interface NavItem {
  name: string;
  icon: React.ElementType;
  page: PageName;
  label: string;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  { name: "Dokumente",  icon: FolderOpen,   page: "Dokumente",  label: "Dokumente" },
  { name: "Lager",     icon: MapPin,       page: "Groups",     label: "Lager" },
  { name: "Warenkorb", icon: ShoppingCart, page: "Cart",       label: "Warenkorb", highlight: true },
  { name: "Suche",     icon: Search,       page: "SearchPage", label: "Suche" },
  { name: "Settings",  icon: Settings,     page: "Settings",   label: "Einstellung" },
];


interface LayoutProps {
  children: React.ReactNode;
  currentPageName: PageName;
  navigate: NavigateFn;
}

export default function Layout({ children, currentPageName, navigate }: LayoutProps): React.ReactElement {
  const { user } = useAuth();
  const { items } = useCart();
  const { headerState } = useHeader();
  const cartCount = items.length;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorLeft, setIndicatorLeft] = useState<number | null>(null);
  const pillTitleRef = useRef<HTMLDivElement>(null);

  const ROOT_PAGES = new Set(["Groups", "Cart", "SearchPage", "Settings"]);
  const showLogo = ROOT_PAGES.has(currentPageName) || !headerState?.title;

  // Synchronous width: ~10px per char + 62px overhead (back btn + padding)
  const pillWidth = showLogo
    ? 44
    : Math.min(62 + (headerState?.title?.length ?? 0) * 10, 280);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [currentPageName]);

  useEffect(() => {
    const activeIdx = navItems.findIndex(item =>
      currentPageName === item.page ||
      (item.page === "Groups" && (currentPageName === "GroupDetail" || currentPageName === "BoxDetail" || currentPageName === "UnboxedDetail"))
    );
    const el = navRefs.current[activeIdx];
    if (el) setIndicatorLeft(el.offsetLeft);
  }, [currentPageName]);


  useEffect(() => {
    if (!user) return;
    return subscribeToUnreadNotifications(user.uid, setNotifications);
  }, [user?.uid]);

  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (
        bellRef.current && !bellRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    setShowNotifs(false);
  };

  const handleNotifClick = (_notif: AppNotification) => {
    setShowNotifs(false);
    navigate("Groups");
  };


  const unreadCount = notifications.length;

  const mainOverflow = currentPageName === "Settings" ? "hidden" : "auto";

  return (
    <div className="app-shell">
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div
            className={`header-pill${showLogo ? "" : " header-pill-expanded"}`}
            style={{ width: pillWidth }}
          >
            <button
              className="header-pill-logo-slot"
              onClick={() => navigate("Settings")}
              tabIndex={showLogo ? 0 : -1}
              style={{ background: "none" }}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" style={styles.avatarImg} referrerPolicy="no-referrer" />
              ) : (
                <div style={styles.avatarInitials}>
                  {getInitials(user?.displayName ?? user?.email ?? "?")}
                </div>
              )}
            </button>
            <div ref={pillTitleRef} className="header-pill-title-slot">
              {headerState?.onBack && (
                <button style={styles.headerBackBtn} onClick={headerState.onBack}>
                  <ChevronLeft size={20} color="#FF7648" />
                </button>
              )}
              <span style={styles.headerTitle}>{headerState?.title ?? ""}</span>
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          {/* Notification Bell */}
          <div style={styles.bellWrapper}>
            <button
              ref={bellRef}
              style={styles.bellBtn}
              className={`bell-btn${bellRinging ? " bell-ringing" : ""}`}
              onClick={() => {
                setShowNotifs((v) => !v);
                setBellRinging(true);
                setTimeout(() => setBellRinging(false), 900);
              }}
              aria-label="Benachrichtigungen"
            >
              <Bell size={20} color={unreadCount > 0 ? "#FF7648" : "var(--c-text-3)"} />
              {unreadCount > 0 && (
                <span style={styles.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {showNotifs && (
              <div ref={panelRef} style={styles.notifPanel}>
                <div style={styles.notifHeader}>
                  <span style={styles.notifTitle}>Benachrichtigungen</span>
                  <button style={styles.notifClose} onClick={() => setShowNotifs(false)}>
                    <X size={16} color="var(--c-text-3)" />
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <div style={styles.notifEmpty}>Keine neuen Benachrichtigungen</div>
                ) : (
                  <>
                    <div style={styles.notifList}>
                      {notifications.map((n) => (
                        <button key={n.id} style={styles.notifItem} onClick={() => handleNotifClick(n)}>
                          <div style={styles.notifDot} />
                          <div style={styles.notifBody}>
                            <span style={styles.notifMsg}>{n.message}</span>
                            <span style={styles.notifTime}>
                              {n.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                              {" · "}{n.createdAt.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button style={styles.markReadBtn} onClick={handleMarkAllRead}>
                      Alle als gelesen markieren
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Content */}
      <main ref={mainRef} style={{ ...styles.main, overflowY: mainOverflow }}>{children}</main>

      {/* Bottom Nav */}
      <nav style={styles.navOuter} className="app-nav">
        <div style={styles.navPill}>
          {indicatorLeft !== null && (
            <div style={{ ...styles.navIndicator, left: indicatorLeft }} />
          )}
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page ||
              (item.page === "Groups" && (currentPageName === "GroupDetail" || currentPageName === "BoxDetail" || currentPageName === "UnboxedDetail"));

            if (item.highlight) {
              return (
                <button
                  key={item.name}
                  ref={el => { navRefs.current[idx] = el; }}
                  onClick={() => navigate(item.page)}
                  style={styles.navItem}
                >
                  <div style={{ position: "relative" }}>
                    <Icon size={20} color={isActive ? "#FF7648" : "var(--c-text-3)"} />
                    {cartCount > 0 && <span style={styles.badge} />}
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.name}
                ref={el => { navRefs.current[idx] = el; }}
                onClick={() => navigate(item.page)}
                style={styles.navItem}
              >
                <Icon size={20} color={isActive ? "#FF7648" : "var(--c-text-3)"} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px",
    paddingTop: "max(10px, env(safe-area-inset-top))",
    background: "#ffffff",
    flexShrink: 0,
    position: "relative",
    zIndex: 100,
    boxShadow: "0 2px 12px rgba(180,168,155,0.25)",
  },
  headerLeft: { display: "flex", alignItems: "center", flex: 1, minWidth: 0 },
  avatarImg: { width: 44, height: 44, borderRadius: "50%", display: "block", objectFit: "cover" },
  avatarInitials: {
    width: 44, height: 44, borderRadius: "50%",
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  },
  headerBackBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: "0 2px", display: "flex", alignItems: "center", flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16, fontWeight: 700, color: "#ffffff",
    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  bellWrapper: { position: "relative" },
  bellBtn: {
    position: "relative", background: "#ffffff", border: "none", cursor: "pointer",
    width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "50%", boxShadow: "var(--neu-raised-sm)",
  },
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    background: "#ef4444", color: "#fff",
    fontSize: 9, fontWeight: 700,
    minWidth: 16, height: 16, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 3px", border: "2px solid var(--c-surface)", lineHeight: 1,
  },
  notifPanel: {
    position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
    width: "calc(100% - 32px)", maxWidth: 420,
    background: "var(--c-surface)",
    borderRadius: 16, boxShadow: "var(--neu-raised)",
    zIndex: 200, overflow: "hidden",
  },
  notifHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid var(--c-border-2)" },
  notifTitle: { fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" },
  notifClose: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 },
  notifEmpty: { padding: "24px 16px", fontSize: 13, color: "var(--c-text-3)", textAlign: "center" },
  notifList: { maxHeight: 280, overflowY: "auto" },
  notifItem: {
    width: "100%", display: "flex", alignItems: "flex-start", gap: 10,
    padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
    textAlign: "left", borderBottom: "1px solid var(--c-border-2)",
  },
  notifDot: { width: 8, height: 8, borderRadius: "50%", background: "#FF7648", marginTop: 4, flexShrink: 0 },
  notifBody: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  notifMsg: { fontSize: 13, color: "var(--c-text-1)", lineHeight: 1.4 },
  notifTime: { fontSize: 11, color: "var(--c-text-3)" },
  markReadBtn: {
    width: "100%", background: "none", border: "none", cursor: "pointer",
    padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#FF7648", textAlign: "center",
  },
  avatar: {
    width: 44, height: 44, borderRadius: "50%",
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(255,118,72,0.25)",
  },
  main: { flex: 1, minHeight: 0, overflowX: "hidden", paddingBottom: 16, overscrollBehavior: "none" },
  navOuter: {
    flexShrink: 0,
    padding: "6px 32px",
    paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)",
    zIndex: 50,
    background: "transparent",
  },
  navPill: {
    position: "relative",
    display: "flex", alignItems: "center", justifyContent: "space-around",
    background: "#ffffff",
    borderRadius: 40,
    padding: "4px 10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
  },
  navIndicator: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 42, height: 42,
    borderRadius: "50%",
    background: "var(--c-bg)",
    boxShadow: "var(--neu-inset)",
    transition: "left 0.38s cubic-bezier(0.34, 1.3, 0.64, 1)",
    pointerEvents: "none",
    zIndex: 0,
  },
  navItem: {
    width: 42, height: 42,
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "50%",
    background: "transparent",
    border: "none", cursor: "pointer",
    flexShrink: 0, padding: 0,
    position: "relative", zIndex: 1,
  },
  navItemActive: {},
  navCartBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "none", cursor: "pointer",
    padding: "2px", flexShrink: 0,
  },
  navCartInner: {
    width: 50, height: 50, borderRadius: "50%",
    background: "linear-gradient(135deg, #FF7648 0%, #e5623a 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    background: "#ef4444", width: 10, height: 10, borderRadius: "50%",
    border: "2px solid transparent",
  },
};
