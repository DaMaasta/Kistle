import React, { useState, useEffect, CSSProperties } from "react";
import { Users, Plus, ChevronRight, Package, Pencil, Check, X, AlertTriangle } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToUserSpaces, createSpace, updateSpace, deleteSpace, getSpaceContentCount } from "../services/spaces.service";
import type { Space } from "../types";

interface GroupsProps {
  navigate: NavigateFn;
}

interface DeleteConfirm {
  id: string;
  name: string;
  boxes: number;
  products: number;
}

export default function Groups({ navigate }: GroupsProps): React.ReactElement {
  const { user } = useAuth();
  const [spaces, setSpaces]               = useState<Space[]>([]);
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

  const groups = spaces.filter((s) => s.isGroup);

  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    try {
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "other", description: "", icon: "👥", color: "#f97316", isGroup: true,
      });
      setNewName(""); setShowCreate(false);
    } finally { setCreating(false); }
  };

  const startEdit = (g: Space) => { setEditingId(g.id); setEditName(g.name); };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    await updateSpace(editingId, { name: editName.trim() });
    setEditingId(null);
  };

  const requestDelete = async (g: Space) => {
    setCheckingId(g.id);
    try {
      const { boxes, products } = await getSpaceContentCount(g.id);
      if (boxes === 0 && products === 0) {
        await deleteSpace(g.id);
      } else {
        setDeleteConfirm({ id: g.id, name: g.name, boxes, products });
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
            <h3 style={styles.modalTitle}>Gruppe löschen?</h3>
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

      <div style={styles.topRow}>
        <div>
          <h1 style={styles.title}>Gruppen</h1>
          <p style={styles.subtitle}>Verwalte deine Lagergruppen</p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
          <Plus size={16} color="#fff" /> Neue Gruppe
        </button>
      </div>

      {showCreate && (
        <div style={styles.createCard}>
          <input style={styles.createInput} placeholder="Gruppenname..." value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
          <div style={styles.createActions}>
            <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); }}>Abbrechen</button>
            <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
              {creating ? "…" : "Erstellen"}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          <Users size={48} color="var(--c-border)" />
          <p style={styles.emptyText}>Noch keine Gruppen. Erstelle eine und lade Mitglieder ein.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {groups.map((g) => (
            <div key={g.id} style={styles.cardWrapper}>
              {editingId === g.id ? (
                <div style={styles.editCard}>
                  <input style={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                  <div style={styles.editActions}>
                    <button style={styles.iconBtn} onClick={handleEdit}><Check size={16} color="#22c55e" /></button>
                    <button style={styles.iconBtn} onClick={() => setEditingId(null)}><X size={16} color="var(--c-text-3)" /></button>
                    <button
                      style={{ ...styles.iconBtn, opacity: checkingId === g.id ? 0.5 : 1 }}
                      disabled={checkingId === g.id}
                      onClick={() => { setEditingId(null); requestDelete(g); }}
                    >
                      <AlertTriangle size={15} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.groupCard}>
                  <button style={styles.cardClickable} onClick={() => navigate("GroupDetail", { group: g })}>
                    <div style={styles.cardTop}>
                      <span style={{ ...styles.groupDot, background: g.color }} />
                      <ChevronRight size={14} color="var(--c-text-4)" />
                    </div>
                    <div style={styles.groupName}>{g.name}</div>
                    <div style={styles.groupStats}>
                      <span style={styles.stat}><Users size={13} color="var(--c-text-3)" />{g.memberIds.length} Mitglieder</span>
                      <span style={styles.stat}><Package size={13} color="var(--c-text-3)" />{g.description || g.type}</span>
                    </div>
                  </button>
                  <div style={styles.cardActions}>
                    <button style={styles.iconBtn} onClick={() => startEdit(g)}><Pencil size={14} color="var(--c-text-3)" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4 },
  newBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-dark-btn)", color: "var(--c-dark-btn-text)", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  createInput: { width: "100%", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--c-bg)", color: "var(--c-text-1)" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  saveBtn: { background: "#f97316", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  emptyState: { textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)", maxWidth: 240 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  cardWrapper: {},
  groupCard: { background: "var(--c-surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" },
  cardClickable: { display: "block", width: "100%", padding: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  groupDot: { width: 10, height: 10, borderRadius: "50%" },
  groupName: { fontSize: 16, fontWeight: 700, color: "var(--c-text-1)", marginBottom: 10 },
  groupStats: { display: "flex", flexDirection: "column", gap: 4 },
  stat: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-3)" },
  cardActions: { display: "flex", justifyContent: "flex-end", gap: 4, padding: "4px 8px 8px" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" },
  editCard: { background: "var(--c-surface)", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  editInput: { width: "100%", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)", boxSizing: "border-box" },
  editActions: { display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalIcon: { width: 52, height: 52, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 },
  modalText: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.5, margin: 0 },
  modalActions: { display: "flex", gap: 10, width: "100%", marginTop: 4 },
  cancelModalBtn: { flex: 1, background: "#f1f5f9", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer" },
  confirmModalBtn: { flex: 1, background: "#ef4444", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
};
