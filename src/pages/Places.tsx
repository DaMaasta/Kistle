import React, { useState, useEffect, CSSProperties } from "react";
import { Search, Plus, ChevronRight, Pencil, Trash2, Check, X, AlertTriangle } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToUserSpaces, createSpace, updateSpace, deleteSpace, getSpaceContentCount } from "../services/spaces.service";
import type { Space } from "../types";

interface PlacesProps {
  navigate: NavigateFn;
}


interface DeleteConfirm {
  id: string;
  name: string;
  boxes: number;
  products: number;
}

export default function Places({ navigate }: PlacesProps): React.ReactElement {
  const { user } = useAuth();
  const [spaces, setSpaces]               = useState<Space[]>([]);
  const [query, setQuery]                 = useState("");
  const [showCreate, setShowCreate]       = useState(false);
  const [newName, setNewName]             = useState("");
  const [creating, setCreating]           = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editName, setEditName]           = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [checkingId, setCheckingId]       = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserSpaces(user.uid, setSpaces);
  }, [user]);

  const places = spaces.filter((s) => !s.isGroup && s.parentId === null);
  const filtered = places.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    try {
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "other", description: "", icon: "📍", color: "#f97316", isGroup: false,
      });
      setNewName(""); setShowCreate(false);
    } finally { setCreating(false); }
  };

  const startEdit = (space: Space) => { setEditingId(space.id); setEditName(space.name); };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    await updateSpace(editingId, { name: editName.trim() });
    setEditingId(null);
  };

  const requestDelete = async (space: Space) => {
    setCheckingId(space.id);
    try {
      const { boxes, products } = await getSpaceContentCount(space.id);
      if (boxes === 0 && products === 0) {
        await deleteSpace(space.id);
      } else {
        setDeleteConfirm({ id: space.id, name: space.name, boxes, products });
      }
    } finally {
      setCheckingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteSpace(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return (
    <div style={styles.container}>

      {/* Bestätigungs-Modal */}
      {deleteConfirm && (
        <div style={styles.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalIcon}><AlertTriangle size={24} color="#f59e0b" /></div>
            <h3 style={styles.modalTitle}>Ort löschen?</h3>
            <p style={styles.modalText}>
              <strong>„{deleteConfirm.name}"</strong> enthält{" "}
              {deleteConfirm.boxes > 0 && <><strong>{deleteConfirm.boxes} {deleteConfirm.boxes === 1 ? "Box" : "Boxen"}</strong></>}
              {deleteConfirm.boxes > 0 && deleteConfirm.products > 0 && " und "}
              {deleteConfirm.products > 0 && <><strong>{deleteConfirm.products} {deleteConfirm.products === 1 ? "Gegenstand" : "Gegenstände"}</strong></>}
              . Alles wird unwiderruflich gelöscht.
            </p>
            <div style={styles.modalActions}>
              <button style={styles.cancelModalBtn} onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
              <button style={styles.confirmModalBtn} onClick={confirmDelete}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.pageHeader}>
        <h1 style={styles.title}>Places</h1>
        <p style={styles.subtitle}>Deine persönlichen Lagerorte</p>
      </div>

      <div style={styles.row}>
        <div style={styles.searchBox}>
          <Search size={16} color="var(--c-text-3)" />
          <input style={styles.searchInput} placeholder="Place suchen..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
          <Plus size={16} color="#fff" /> Neu
        </button>
      </div>

      {showCreate && (
        <div style={styles.createCard}>
          <input style={styles.createInput} placeholder="Name des Places..." value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
          <div style={styles.createActions}>
            <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); }}>Abbrechen</button>
            <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
              {creating ? "…" : "Erstellen"}
            </button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {filtered.length === 0 ? (
          <div style={styles.empty}>{places.length === 0 ? "Noch keine Places. Erstelle deinen ersten!" : "Keine Places gefunden"}</div>
        ) : (
          filtered.map((space, i) => (
            <div key={space.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--c-border-2)" : "none" }}>
              {editingId === space.id ? (
                <div style={styles.editRow}>
                  <input style={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                  <button style={styles.iconActionBtn} onClick={handleEdit}><Check size={16} color="#22c55e" /></button>
                  <button style={styles.iconActionBtn} onClick={() => setEditingId(null)}><X size={16} color="var(--c-text-3)" /></button>
                  <button
                    style={{ ...styles.iconActionBtn, opacity: checkingId === space.id ? 0.5 : 1 }}
                    disabled={checkingId === space.id}
                    onClick={() => { setEditingId(null); requestDelete(space); }}
                  >
                    <Trash2 size={15} color="#ef4444" />
                  </button>
                </div>
              ) : (
                <div style={styles.itemRow}>
                  <button style={styles.itemClickable} onClick={() => navigate("PlaceDetail", { place: space })}>
                    <div style={styles.itemContent}>
                      <div style={styles.itemDotRow}>
                        <span style={{ ...styles.dot, background: space.color }} />
                        <span style={styles.itemName}>{space.name}</span>
                      </div>
                      <span style={styles.itemSub}>{space.description || space.type}</span>
                    </div>
                    <ChevronRight size={16} color="var(--c-text-4)" />
                  </button>
                  <button style={styles.iconActionBtn} onClick={() => startEdit(space)}><Pencil size={15} color="var(--c-text-3)" /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px" },
  pageHeader: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4 },
  row: { display: "flex", gap: 10, marginBottom: 16 },
  searchBox: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "0 14px" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: 14, color: "var(--c-text-1)", background: "transparent", padding: "12px 0" },
  newBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-dark-btn)", color: "var(--c-dark-btn-text)", border: "none", borderRadius: 12, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  createInput: { width: "100%", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--c-bg)", color: "var(--c-text-1)" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  saveBtn: { background: "#f97316", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  list: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  itemRow: { display: "flex", alignItems: "center" },
  itemClickable: { flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0 },
  iconWrap: { width: 40, height: 40, background: "var(--c-accent-bg)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemContent: { flex: 1, minWidth: 0 },
  itemDotRow: { display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  itemName: { fontSize: 15, fontWeight: 600, color: "var(--c-text-1)" },
  itemSub: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2, textTransform: "capitalize" },
  iconActionBtn: { background: "none", border: "none", cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", flexShrink: 0 },
  editRow: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" },
  editInput: { flex: 1, border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)" },
  empty: { padding: "32px 16px", textAlign: "center", color: "var(--c-text-3)", fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalIcon: { width: 52, height: 52, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 },
  modalText: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.5, margin: 0 },
  modalActions: { display: "flex", gap: 10, width: "100%", marginTop: 4 },
  cancelModalBtn: { flex: 1, background: "#f1f5f9", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer" },
  confirmModalBtn: { flex: 1, background: "#ef4444", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
};
