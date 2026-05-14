import React, { useState, useEffect, CSSProperties } from "react";
import { ChevronLeft, Plus, ChevronRight, Pencil, Trash2, Check, X, Package, Inbox } from "lucide-react";
import type { NavigateFn, PageParams } from "../App";
import type { Space } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToChildSpaces, createSpace, updateSpace, deleteSpace } from "../services/spaces.service";
import { subscribeToSpaceProducts } from "../services/products.service";

interface PlaceDetailProps {
  navigate: NavigateFn;
  params: PageParams;
}

export default function PlaceDetail({ navigate, params }: PlaceDetailProps): React.ReactElement {
  const place = params.place as Space;
  const { user } = useAuth();

  const [boxes, setBoxes]           = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [creating, setCreating]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [unboxedCount, setUnboxedCount] = useState(0);

  useEffect(() => {
    if (!place?.id) return;
    return subscribeToChildSpaces(place.id, setBoxes);
  }, [place?.id]);

  useEffect(() => {
    if (!place?.id) return;
    return subscribeToSpaceProducts(place.id, (products) => setUnboxedCount(products.length));
  }, [place?.id]);

  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    try {
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "box", parentId: place.id, description: "", icon: "📦", color: "#f97316",
      });
      setNewName(""); setShowCreate(false);
    } finally { setCreating(false); }
  };

  const startEdit = (box: Space) => { setEditingId(box.id); setEditName(box.name); setDeleteId(null); };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    await updateSpace(editingId, { name: editName.trim() });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteSpace(id);
    setDeleteId(null);
  };

  return (
    <div style={styles.container}>
      <button style={styles.back} onClick={() => navigate("Places")}>
        <ChevronLeft size={16} color="#f97316" />
        <span style={styles.backText}>Zurück zu Places</span>
      </button>

      <div style={styles.header}>
        <h1 style={styles.title}>{place?.name ?? "Place"}</h1>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
          <Plus size={15} color="#fff" /> Box
        </button>
      </div>

      {showCreate && (
        <div style={styles.createCard}>
          <input style={styles.createInput} placeholder="Box-Name..." value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
          <div style={styles.createActions}>
            <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); }}>Abbrechen</button>
            <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
              {creating ? "…" : "Erstellen"}
            </button>
          </div>
        </div>
      )}

      {boxes.length === 0 && !showCreate && (
        <div style={styles.emptyState}>
          <Package size={48} color="var(--c-border)" />
          <p style={styles.emptyText}>Noch keine Boxen in diesem Place</p>
          <button style={styles.emptyBtn} onClick={() => setShowCreate(true)}>
            <Plus size={14} color="#f97316" /> Erste Box erstellen
          </button>
        </div>
      )}

      {boxes.length > 0 && (
        <div style={styles.grid}>
          {boxes.map((box) => (
            <div key={box.id}>
              {editingId === box.id ? (
                <div style={styles.editCard}>
                  <input style={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                  <div style={styles.editActions}>
                    <button style={styles.iconBtn} onClick={handleEdit}><Check size={15} color="#22c55e" /></button>
                    <button style={styles.iconBtn} onClick={() => setEditingId(null)}><X size={15} color="var(--c-text-3)" /></button>
                    <button style={styles.iconBtn} onClick={() => { setDeleteId(box.id); setEditingId(null); }}><Trash2 size={14} color="#ef4444" /></button>
                  </div>
                </div>
              ) : deleteId === box.id ? (
                <div style={styles.deleteCard}>
                  <span style={styles.deleteText}>„{box.name}" löschen?</span>
                  <button style={styles.confirmDeleteBtn} onClick={() => handleDelete(box.id)}>Löschen</button>
                  <button style={styles.cancelBtn} onClick={() => setDeleteId(null)}>Nein</button>
                </div>
              ) : (
                <div style={styles.boxCard}>
                  <button style={styles.boxClickable} onClick={() => navigate("BoxDetail", { box, place })}>
                    <div style={styles.boxTop}>
                      <Package size={22} color="#f97316" />
                      <ChevronRight size={14} color="var(--c-text-4)" />
                    </div>
                    <div style={styles.boxName}>{box.name}</div>
                    <div style={styles.boxSub}>0 Gegenstände</div>
                  </button>
                  <div style={styles.boxActions}>
                    <button style={styles.iconBtn} onClick={() => startEdit(box)}><Pencil size={13} color="var(--c-text-3)" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unboxed Items Karte */}
      <button
        style={styles.unboxedCard}
        onClick={() => navigate("UnboxedDetail", { space: place, from: "PlaceDetail", fromParam: { place } })}
      >
        <div style={styles.unboxedIcon}>
          <Inbox size={20} color="#f97316" />
        </div>
        <div style={styles.unboxedInfo}>
          <div style={styles.unboxedTitle}>Unboxed Items</div>
          <div style={styles.unboxedSub}>{unboxedCount} Gegenstand{unboxedCount !== 1 ? "e" : ""}</div>
        </div>
        <ChevronRight size={16} color="var(--c-text-4)" />
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: 16 },
  backText: { color: "#f97316", fontSize: 14, fontWeight: 600 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  newBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-dark-btn)", color: "var(--c-dark-btn-text)", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  createInput: { width: "100%", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--c-bg)", color: "var(--c-text-1)" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  saveBtn: { background: "#f97316", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  emptyState: { textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)" },
  emptyBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-accent-bg)", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#f97316", cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  boxCard: { background: "var(--c-surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" },
  boxClickable: { display: "block", width: "100%", padding: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  boxTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  boxName: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)", marginBottom: 4 },
  boxSub: { fontSize: 12, color: "var(--c-text-3)" },
  boxActions: { display: "flex", justifyContent: "flex-end", gap: 4, padding: "0 8px 8px" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" },
  editCard: { background: "var(--c-surface)", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  editInput: { width: "100%", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)", boxSizing: "border-box" },
  editActions: { display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" },
  deleteCard: { background: "var(--c-surface)", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8 },
  deleteText: { fontSize: 13, color: "var(--c-text-1)", fontWeight: 500 },
  confirmDeleteBtn: { background: "#ef4444", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  unboxedCard: { width: "100%", display: "flex", alignItems: "center", gap: 14, background: "var(--c-surface)", borderRadius: 16, padding: "16px", border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 4 },
  unboxedIcon: { width: 44, height: 44, borderRadius: 12, background: "var(--c-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  unboxedInfo: { flex: 1 },
  unboxedTitle: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" },
  unboxedSub: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2 },
};
