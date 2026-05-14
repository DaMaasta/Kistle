import React, { useState, useEffect, CSSProperties } from "react";
import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import Places from "./pages/Places";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import PlaceDetail from "./pages/PlaceDetail";
import BoxDetail from "./pages/BoxDetail";
import Cart from "./pages/Cart";
import SearchPage from "./pages/SearchPage";
import Settings from "./pages/Settings";
import LoginPage from "./pages/LoginPage";
import UnboxedDetail from "./pages/UnboxedDetail";
import { useAuth } from "./contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config/firebase";
import type { Space } from "./types";

export type PageName =
  | "Dashboard"
  | "Places"
  | "PlaceDetail"
  | "BoxDetail"
  | "Groups"
  | "GroupDetail"
  | "UnboxedDetail"
  | "Cart"
  | "SearchPage"
  | "Settings";

export type PageParams = Record<string, unknown>;

export type NavigateFn = (page: PageName, params?: PageParams) => void;

function getPendingInvite(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite");
}

function clearInviteParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());
}

export default function App(): React.ReactElement {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageName>("Dashboard");
  const [pageParams, setPageParams] = useState<PageParams>({});
  const [pendingInvite] = useState<string | null>(getPendingInvite);

  useEffect(() => {
    if (!user || !pendingInvite) return;
    getDoc(doc(db, "spaces", pendingInvite))
      .then((snap) => {
        if (snap.exists()) {
          const group = { id: snap.id, ...snap.data() } as Space;
          clearInviteParam();
          setCurrentPage("GroupDetail");
          setPageParams({ group });
        }
      })
      .catch(() => {});
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
    setCurrentPage(page);
    setPageParams(params);
  };

  const renderPage = (): React.ReactElement => {
    switch (currentPage) {
      case "Dashboard":   return <Dashboard navigate={navigate} />;
      case "Places":      return <Places navigate={navigate} />;
      case "PlaceDetail": return <PlaceDetail navigate={navigate} params={pageParams} />;
      case "BoxDetail":   return <BoxDetail navigate={navigate} params={pageParams} />;
      case "Groups":      return <Groups navigate={navigate} />;
      case "GroupDetail": return <GroupDetail navigate={navigate} params={pageParams} />;
      case "UnboxedDetail": return <UnboxedDetail navigate={navigate} params={pageParams} />;
      case "Cart":        return <Cart navigate={navigate} />;
      case "SearchPage":  return <SearchPage navigate={navigate} />;
      case "Settings":    return <Settings navigate={navigate} />;
      default:            return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <Layout currentPageName={currentPage} navigate={navigate}>
      <div key={currentPage} className="page-transition">
        {renderPage()}
      </div>
    </Layout>
  );
}

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
