import React, { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import Layout from "./Layout";
import Dokumente from "./pages/Dokumente";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import BoxDetail from "./pages/BoxDetail";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import SearchPage from "./pages/SearchPage";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import Erweiterungen from "./pages/Erweiterungen";
import NukiSettings from "./pages/NukiSettings";
import LoginPage from "./pages/LoginPage";
import UnboxedDetail from "./pages/UnboxedDetail";
import ItemView from "./pages/ItemView";
import { useAuth } from "./contexts/AuthContext";
import { getSpace } from "./services/spaces.service";

export type PageName =
  | "Dokumente"
  | "BoxDetail"
  | "Groups"
  | "GroupDetail"
  | "UnboxedDetail"
  | "Cart"
  | "SearchPage"
  | "Settings"
  | "AccountSettings"
  | "Erweiterungen"
  | "NukiSettings"
  | "ProductDetail"
  | "ItemView";

export type PageParams = Record<string, unknown>;

export type NavigateFn = (page: PageName, params?: PageParams) => void;

type NavDirection = "forward" | "back" | "lateral";

const PAGE_DEPTH: Record<PageName, number> = {
  Groups:          0,
  Dokumente:       1,
  Cart:            1,
  SearchPage:      1,
  Settings:        1,
  GroupDetail:     2,
  AccountSettings:  2,
  Erweiterungen:    2,
  NukiSettings:     3,
  UnboxedDetail:   3,
  BoxDetail:       3,
  ProductDetail:   4,
  ItemView:        4,
};

const TAB_PAGES = new Set<PageName>(["Groups", "Dokumente", "Cart", "SearchPage", "Settings"]);
const TAB_ORDER: PageName[] = ["Dokumente", "Groups", "Cart", "SearchPage", "Settings"];


function getPendingInvite(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite");
}

function clearInviteParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState(window.history.state, "", url.toString());
}

function getInitialPage(): PageName {
  return "Groups";
}

export default function App(): React.ReactElement {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageName>(getInitialPage);
  const [pageParams, setPageParams]   = useState<PageParams>({});
  const [navDir, setNavDir]           = useState<NavDirection>("lateral");
  const [pendingInvite] = useState<string | null>(getPendingInvite);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    });
  }, []);

  // Stable ref so the popstate handler always sees the current page without re-registering
  const currentPageRef = useRef<PageName>(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Set initial history entry so the first back-navigation has state to restore
  useEffect(() => {
    window.history.replaceState({ page: "Groups", params: {} }, "");
  }, []);

  // Browser back / forward button support
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (!e.state?.page) return;
      const toPage = e.state.page as PageName;
      const params = (e.state.params ?? {}) as PageParams;
      const fromDepth = PAGE_DEPTH[currentPageRef.current] ?? 0;
      const toDepth   = PAGE_DEPTH[toPage] ?? 0;
      setNavDir(toDepth < fromDepth ? "back" : toDepth > fromDepth ? "forward" : "lateral");
      setCurrentPage(toPage);
      setPageParams(params);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Invite-Link handling — always clear the URL param, whether the space exists or not
  useEffect(() => {
    if (!user || !pendingInvite) return;
    getSpace(pendingInvite)
      .then((group) => {
        clearInviteParam();
        if (group) {
          window.history.pushState({ page: "GroupDetail", params: { group } }, "");
          setNavDir("forward");
          setCurrentPage("GroupDetail");
          setPageParams({ group });
        }
      })
      .catch(() => { clearInviteParam(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingInvite]);

  if (loading) {
    return (
      <div style={spinnerStyles.root}>
        <div style={spinnerStyles.spinner} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const navigate: NavigateFn = (page, params = {}) => {
    const from = PAGE_DEPTH[currentPage] ?? 0;
    const to   = PAGE_DEPTH[page] ?? 0;
    const isTabSwitch = TAB_PAGES.has(currentPage) && TAB_PAGES.has(page);
    const fromTabIdx = TAB_ORDER.indexOf(currentPage);
    const toTabIdx   = TAB_ORDER.indexOf(page);
    const dir: NavDirection = isTabSwitch
      ? (toTabIdx > fromTabIdx ? "forward" : toTabIdx < fromTabIdx ? "back" : "lateral")
      : to > from ? "forward" : to < from ? "back" : "lateral";
    setNavDir(dir);
    setCurrentPage(page);
    setPageParams(params);
    window.history.pushState({ page, params }, "");
  };

  const renderPage = (): React.ReactElement => {
    switch (currentPage) {
      case "Dokumente":   return <Dokumente navigate={navigate} />;
      case "BoxDetail":   return <BoxDetail navigate={navigate} params={pageParams} />;
      case "Groups":      return <Groups navigate={navigate} />;
      case "GroupDetail": return <GroupDetail navigate={navigate} params={pageParams} />;
      case "UnboxedDetail": return <UnboxedDetail navigate={navigate} params={pageParams} />;
      case "Cart":        return <Cart navigate={navigate} />;
      case "SearchPage":  return <SearchPage navigate={navigate} />;
      case "Settings":         return <Settings navigate={navigate} />;
      case "AccountSettings":  return <AccountSettings navigate={navigate} />;
      case "Erweiterungen":    return <Erweiterungen navigate={navigate} />;
      case "NukiSettings":     return <NukiSettings navigate={navigate} />;
      case "ProductDetail":    return <ProductDetail navigate={navigate} params={pageParams} />;
      case "ItemView":         return <ItemView navigate={navigate} params={pageParams} />;
      default:            return <Groups navigate={navigate} />;
    }
  };

  return (
    <>
      {updateReady && (
        <div style={updateBannerStyle} onClick={() => window.location.reload()}>
          Neue Version verfügbar – Tippen zum Aktualisieren
        </div>
      )}
      <Layout currentPageName={currentPage} navigate={navigate}>
        <div key={currentPage} className={`page-${navDir}`}>
          {renderPage()}
        </div>
      </Layout>
    </>
  );
}

const updateBannerStyle: CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
  background: "#f97316", color: "#fff",
  padding: "10px 16px",
  paddingTop: "calc(10px + env(safe-area-inset-top))",
  textAlign: "center", fontSize: 13, fontWeight: 600,
  cursor: "pointer",
};

const spinnerStyles: Record<string, CSSProperties> = {
  root: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" },
  spinner: {
    width: 40, height: 40,
    border: "3px solid #e2e8f0",
    borderTopColor: "#f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
