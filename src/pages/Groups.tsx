import React, { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { Users, Plus, ChevronRight, Package, Pencil, Check, X, AlertTriangle, QrCode, Camera, Upload, Copy, RefreshCw, Key, Trash2 } from "lucide-react";
import jsQR from "jsqr";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToUserSpaces, createSpace, updateSpace, deleteSpace, removeAccessCode, getSpaceContentCount, joinGroup, getSpace, regenerateAccessCode, generateAccessCode } from "../services/spaces.service";
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

type JoinStep = "choose" | "camera" | "uploading" | "joining" | "error";

function extractGroupId(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.searchParams.get("invite");
  } catch {
    return null;
  }
}

export default function Groups({ navigate }: GroupsProps): React.ReactElement {
  const { user } = useAuth();
  const [spaces, setSpaces]               = useState<Space[]>([]);
  const [showCreate, setShowCreate]       = useState(false);
  const [newName, setNewName]             = useState("");
  const [newDesc, setNewDesc]             = useState("");
  const [newWithCode, setNewWithCode]     = useState(false);
  const [newCodeLength, setNewCodeLength] = useState(4);
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState("");
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editName, setEditName]           = useState("");
  const [editCodeLength, setEditCodeLength] = useState(0);
  const [editCodeDirty, setEditCodeDirty] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [checkingId, setCheckingId]       = useState<string | null>(null);

  // Zutritt state
  const [copiedId, setCopiedId]             = useState<string | null>(null);
  const [regenConfirmId, setRegenConfirmId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Join modal
  const [showJoin, setShowJoin]     = useState(false);
  const [joinStep, setJoinStep]     = useState<JoinStep>("choose");
  const [joinError, setJoinError]   = useState("");
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserSpaces(user.uid, setSpaces);
  }, [user]);

  const groups = spaces.filter((s) => s.isGroup);

  const handleCopy = async (g: Space) => {
    if (!g.accessCode) return;
    await navigator.clipboard.writeText(g.accessCode);
    setCopiedId(g.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegen = async (g: Space) => {
    if (regenConfirmId !== g.id) { setRegenConfirmId(g.id); return; }
    setRegenConfirmId(null);
    setRegeneratingId(g.id);
    try { await regenerateAccessCode(g.id, g.accessCode?.length ?? 4); }
    finally { setRegeneratingId(null); }
  };

  // ── Camera cleanup ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const closeJoin = useCallback(() => {
    stopCamera();
    setShowJoin(false);
    setJoinStep("choose");
    setJoinError("");
  }, [stopCamera]);

  // ── After decoding a group ID ──────────────────────────────────────────
  const handleGroupId = useCallback(async (groupId: string) => {
    if (!user) return;
    stopCamera();
    setJoinStep("joining");
    try {
      const space = await getSpace(groupId);
      if (!space) { setJoinError("Ort nicht gefunden."); setJoinStep("error"); return; }
      if (space.memberIds.includes(user.uid)) {
        closeJoin();
        navigate("GroupDetail", { group: space });
        return;
      }
      await joinGroup(groupId, user.uid, user.email ?? "", user.displayName ?? "");
      const updated = await getSpace(groupId);
      closeJoin();
      navigate("GroupDetail", { group: updated ?? space });
    } catch {
      setJoinError("Fehler beim Beitreten. Versuche es erneut.");
      setJoinStep("error");
    }
  }, [user, stopCamera, closeJoin, navigate]);

  // ── Camera scanning ────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setJoinStep("camera");
    setJoinError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setJoinError("Kamera konnte nicht geöffnet werden.");
      setJoinStep("error");
      return;
    }

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code) {
        const groupId = extractGroupId(code.data);
        if (groupId) { handleGroupId(groupId); return; }
      }
      rafRef.current = requestAnimationFrame(scan);
    };
    rafRef.current = requestAnimationFrame(scan);
  }, [handleGroupId]);

  // ── File upload ────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJoinStep("uploading");
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      URL.revokeObjectURL(img.src);
      if (!code) {
        setJoinError("Kein QR-Code im Bild gefunden.");
        setJoinStep("error");
        return;
      }
      const groupId = extractGroupId(code.data);
      if (!groupId) {
        setJoinError("QR-Code enthält keinen gültigen Einladungslink.");
        setJoinStep("error");
        return;
      }
      handleGroupId(groupId);
    };
    img.onerror = () => {
      setJoinError("Bild konnte nicht geladen werden.");
      setJoinStep("error");
    };
  }, [handleGroupId]);

  // ── Group CRUD ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const code = newWithCode && newCodeLength > 0 ? generateAccessCode(newCodeLength) : undefined;
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "other", description: newDesc.trim(),
        icon: "👥", color: "#f97316", isGroup: true,
        ...(code ? { accessCode: code } : {}),
      });
      setNewName(""); setNewDesc(""); setNewWithCode(false); setNewCodeLength(4); setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erstellen fehlgeschlagen");
    } finally { setCreating(false); }
  };

  const startEdit = (g: Space) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditCodeLength(g.accessCode?.length ?? 0);
    setEditCodeDirty(false);
  };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    if (editCodeDirty) {
      if (editCodeLength === 0) {
        await Promise.all([
          updateSpace(editingId, { name: editName.trim() }),
          removeAccessCode(editingId),
        ]);
      } else {
        await updateSpace(editingId, { name: editName.trim(), accessCode: generateAccessCode(editCodeLength) });
      }
    } else {
      await updateSpace(editingId, { name: editName.trim() });
    }
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
    } finally { setCheckingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteSpace(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return (
    <div style={styles.container}>

      {/* Löschen-Modal */}
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

      {/* Beitreten-Modal */}
      {showJoin && (
        <div style={styles.overlay} onClick={closeJoin}>
          <div style={styles.joinModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.joinHeader}>
              <div style={styles.joinHeaderLeft}>
                <div style={styles.joinHeaderIcon}><QrCode size={16} color="#f97316" /></div>
                <span style={styles.joinTitle}>Ort beitreten</span>
              </div>
              <button style={styles.closeBtn} onClick={closeJoin}><X size={18} color="#94a3b8" /></button>
            </div>

            {joinStep === "choose" && (
              <>
                <p style={styles.joinSub}>Scanne den QR-Code des Ortes oder lade ein Bild hoch.</p>
                <div style={styles.joinOptions}>
                  <button style={styles.joinOptionBtn} onClick={startCamera}>
                    <div style={styles.joinOptionIcon}><Camera size={28} color="#f97316" /></div>
                    <span style={styles.joinOptionLabel}>Kamera</span>
                    <span style={styles.joinOptionSub}>QR-Code scannen</span>
                  </button>
                  <button style={styles.joinOptionBtn} onClick={() => fileInputRef.current?.click()}>
                    <div style={styles.joinOptionIcon}><Upload size={28} color="#f97316" /></div>
                    <span style={styles.joinOptionLabel}>Bild hochladen</span>
                    <span style={styles.joinOptionSub}>Aus Fotos wählen</span>
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              </>
            )}

            {joinStep === "camera" && (
              <>
                <p style={styles.joinSub}>Halte die Kamera auf den QR-Code des Ortes.</p>
                <div style={styles.cameraWrap}>
                  <video ref={videoRef} style={styles.cameraVideo} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <div style={styles.scanFrame} />
                </div>
                <button style={styles.cancelJoinBtn} onClick={() => { stopCamera(); setJoinStep("choose"); }}>Abbrechen</button>
              </>
            )}

            {(joinStep === "uploading" || joinStep === "joining") && (
              <div style={styles.joinLoading}>
                <div style={styles.spinner} />
                <p style={styles.joinLoadingText}>
                  {joinStep === "uploading" ? "Bild wird gelesen…" : "Ort wird beigetreten…"}
                </p>
              </div>
            )}

            {joinStep === "error" && (
              <>
                <div style={styles.joinErrorBox}>{joinError}</div>
                <div style={styles.joinRetryRow}>
                  <button style={styles.cancelJoinBtn} onClick={() => setJoinStep("choose")}>Erneut versuchen</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={styles.topRow}>
        <div style={styles.topBtns}>
          <button style={styles.joinBtn} onClick={() => { setShowJoin(true); setJoinStep("choose"); setJoinError(""); }}>
            <QrCode size={15} color="#f97316" /> Beitreten
          </button>
          <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
            <Plus size={16} color="#fff" /> Neues Lager
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={styles.createCard}>
          <input style={styles.createInput} placeholder="Name des Ortes..." value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
          <input style={{ ...styles.createInput, marginTop: 8, fontSize: 13, color: "var(--c-text-2)" }} placeholder="Beschreibung (optional)..." value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <button style={styles.codeToggle} onClick={() => { setNewWithCode((v) => !v); setNewCodeLength(4); }} type="button">
            <span style={styles.codeToggleLabel}>Zugangscode</span>
            <div style={{ ...styles.toggle2, background: newWithCode ? "#f97316" : "var(--c-surface-2)" }}>
              <div style={{ ...styles.toggleThumb2, transform: newWithCode ? "translateX(18px)" : "translateX(0)" }} />
            </div>
          </button>
          {newWithCode && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>Stellen:</span>
              <button style={styles.stepBtn} onClick={() => setNewCodeLength((v) => Math.max(1, v - 1))}>−</button>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--c-text-1)", minWidth: 24, textAlign: "center" as const }}>{newCodeLength}</span>
              <button style={styles.stepBtn} onClick={() => setNewCodeLength((v) => Math.min(12, v + 1))}>+</button>
            </div>
          )}
          {createError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{createError}</div>}
          <div style={styles.createActions}>
            <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setCreateError(""); }}>Abbrechen</button>
            <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
              {creating ? "…" : "Erstellen"}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          <Users size={48} color="var(--c-border)" />
          <p style={styles.emptyText}>Noch keine Lager. Erstelle eines und lade Mitglieder ein.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {groups.map((g) => {
            const isOwner = g.ownerId === user?.uid;
            const isRegenerating = regeneratingId === g.id;
            return (
              <div key={g.id} style={styles.listCard}>
                {editingId === g.id ? (
                  <div style={styles.editCard}>
                    <input style={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "4px 0" }}>
                      <span style={{ fontSize: 12, color: "var(--c-text-3)", fontWeight: 600 }}>Code-Stellen:</span>
                      <button style={styles.stepBtn} onClick={() => { setEditCodeLength((v) => Math.max(0, v - 1)); setEditCodeDirty(true); }}>−</button>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--c-text-1)", minWidth: 20, textAlign: "center" as const }}>
                        {editCodeLength === 0 ? "–" : editCodeLength}
                      </span>
                      <button style={styles.stepBtn} onClick={() => { setEditCodeLength((v) => Math.min(12, v + 1)); setEditCodeDirty(true); }}>+</button>
                      <span style={{ fontSize: 11, color: "var(--c-text-4)" }}>
                        {editCodeLength === 0 ? "(kein Code)" : "→ neuer Code wird generiert"}
                      </span>
                    </div>
                    <div style={styles.editActions}>
                      <button style={styles.editSaveBtn} onClick={handleEdit}>
                        <Check size={14} color="#fff" /> Speichern
                      </button>
                      <button style={styles.editCancelBtn} onClick={() => setEditingId(null)}>
                        Abbrechen
                      </button>
                      <button
                        style={{ ...styles.editDeleteBtn, opacity: checkingId === g.id ? 0.5 : 1 }}
                        disabled={checkingId === g.id}
                        onClick={() => { setEditingId(null); requestDelete(g); }}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Main row */}
                    <div style={styles.listRow}>
                      <button style={styles.listMain} onClick={() => navigate("GroupDetail", { group: g })}>
                        <div style={styles.listIcon}>
                          <Package size={18} color="#f97316" />
                        </div>
                        <div style={styles.listInfo}>
                          <span style={styles.listName}>{g.name}</span>
                          <span style={styles.listMeta}>
                            <Users size={11} color="var(--c-text-3)" />
                            {g.memberIds.length} Mitglieder
                            {g.description ? ` · ${g.description}` : ""}
                          </span>
                        </div>
                        <ChevronRight size={15} color="var(--c-text-4)" />
                      </button>
                      {g.members[user?.uid ?? ""]?.role !== "viewer" && (
                        <button style={styles.iconBtn} onClick={() => startEdit(g)}>
                          <Pencil size={14} color="var(--c-text-3)" />
                        </button>
                      )}
                    </div>

                    {/* Zutritt row — nur wenn Code vorhanden */}
                    {g.accessCode && <div style={styles.zutrittRow}>
                      <div style={styles.zutrittIcon}><Key size={13} color="#f97316" /></div>
                      <span style={styles.zutrittLabel}>Zutritt</span>
                      <span style={styles.zutrittCode}>{g.accessCode ?? "—"}</span>
                      <div style={styles.zutrittActions}>
                        <button style={styles.zutrittBtn} onClick={() => handleCopy(g)} title="Kopieren">
                          {copiedId === g.id
                            ? <Check size={13} color="#22c55e" />
                            : <Copy size={13} color="var(--c-text-3)" />}
                        </button>
                        {isOwner && (
                          <>
                            {regenConfirmId === g.id && (
                              <span style={styles.regenHint}>Bestätigen?</span>
                            )}
                            <button
                              style={{ ...styles.zutrittBtn, opacity: isRegenerating ? 0.5 : 1, background: regenConfirmId === g.id ? "var(--c-accent-bg)" : "none" }}
                              onClick={() => handleRegen(g)}
                              disabled={isRegenerating}
                              title="Neuen Code generieren"
                            >
                              <RefreshCw size={13} color={regenConfirmId === g.id ? "#f97316" : "var(--c-text-3)"}
                                style={{ animation: isRegenerating ? "spin 0.8s linear infinite" : "none" }} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px", width: "100%", boxSizing: "border-box" as const, overflowX: "hidden" as const },
  topRow: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 12 },
  topBtns: { display: "flex", gap: 8, alignItems: "center" },
  joinBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--c-accent-bg)", color: "#f97316", border: "1.5px solid #f97316", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const },
  newBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--c-dark-btn)", color: "var(--c-dark-btn-text)", border: "none", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const },
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "var(--neu-raised)" },
  createInput: { width: "100%", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" as const, background: "var(--c-bg)", color: "var(--c-text-1)" },
  stepBtn: { width: 28, height: 28, borderRadius: 8, border: "1.5px solid var(--c-border)", background: "var(--c-surface-2)", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-1)" },
  codeToggle: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", width: "100%", padding: "10px 2px 2px" },
  codeToggleLabel: { fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  toggle2: { width: 42, height: 24, borderRadius: 12, position: "relative" as const, transition: "background 0.2s", flexShrink: 0 },
  toggleThumb2: { position: "absolute" as const, top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.2s" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  saveBtn: { background: "#f97316", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  emptyState: { textAlign: "center" as const, padding: "60px 20px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)", maxWidth: 240 },
  list: { display: "flex", flexDirection: "column" as const, gap: 10 },
  listCard: { background: "var(--c-surface)", borderRadius: 16, boxShadow: "var(--neu-raised-sm)", overflow: "hidden" },
  listRow: { display: "flex", alignItems: "center" },
  listMain: { flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const },
  listIcon: { width: 38, height: 38, borderRadius: 10, background: "var(--c-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  listInfo: { flex: 1, display: "flex", flexDirection: "column" as const, gap: 3, minWidth: 0 },
  listName: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" },
  listMeta: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--c-text-3)" },
  zutrittRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 10px", borderTop: "1px solid var(--c-border-2)", background: "var(--c-surface)" },
  zutrittIcon: { width: 22, height: 22, borderRadius: 6, background: "var(--c-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  zutrittLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.05em", flexShrink: 0 },
  zutrittCode: { fontSize: 18, fontWeight: 800, color: "var(--c-text-1)", letterSpacing: "0.18em", fontFamily: "ui-monospace,'SF Mono',monospace", flex: 1 },
  zutrittActions: { display: "flex", gap: 2 },
  zutrittBtn: { background: "none", border: "none", cursor: "pointer", padding: 5, display: "flex", alignItems: "center", borderRadius: 6 },
  regenHint: { fontSize: 10, fontWeight: 700, color: "#f97316", whiteSpace: "nowrap" as const },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" },
  editCard: { background: "var(--c-surface)", borderRadius: 16, padding: 14 },
  editInput: { width: "100%", border: "1px solid #f97316", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)", boxSizing: "border-box" as const },
  editActions: { display: "flex", gap: 8, marginTop: 10 },
  editSaveBtn:   { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#22c55e", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" },
  editCancelBtn: { flex: 1, background: "var(--c-surface-2)", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer" },
  editDeleteBtn: { width: 40, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "var(--c-surface)", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, boxShadow: "var(--neu-raised-lg)" },
  modalIcon: { width: 52, height: 52, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 },
  modalText: { fontSize: 14, color: "#475569", textAlign: "center" as const, lineHeight: 1.5, margin: 0 },
  modalActions: { display: "flex", gap: 10, width: "100%", marginTop: 4 },
  cancelModalBtn: { flex: 1, background: "#f1f5f9", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer" },
  confirmModalBtn: { flex: 1, background: "#ef4444", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },

  // Join modal
  joinModal: { background: "var(--c-surface)", borderRadius: 24, padding: "24px 20px", width: "100%", maxWidth: 360, maxHeight: "calc(100dvh - 40px)", overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 16, boxShadow: "var(--neu-raised-lg)" },
  joinHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  joinHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  joinHeaderIcon: { width: 32, height: 32, background: "var(--c-accent-bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  joinTitle: { fontSize: 17, fontWeight: 800, color: "var(--c-text-1)" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 },
  joinSub: { fontSize: 13, color: "var(--c-text-3)", margin: 0, lineHeight: 1.5 },
  joinOptions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  joinOptionBtn: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, background: "var(--c-surface-2)", border: "1.5px solid var(--c-border)", borderRadius: 16, padding: "20px 12px", cursor: "pointer" },
  joinOptionIcon: { width: 52, height: 52, background: "var(--c-accent-bg)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  joinOptionLabel: { fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" },
  joinOptionSub: { fontSize: 11, color: "var(--c-text-3)", textAlign: "center" as const },
  cameraWrap: { position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "1", width: "100%" },
  cameraVideo: { width: "100%", height: "100%", objectFit: "cover" as const, display: "block" },
  scanFrame: {
    position: "absolute", inset: "20%",
    border: "2.5px solid #f97316", borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
  },
  cancelJoinBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer", width: "100%" },
  joinLoading: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 16, padding: "32px 0" },
  spinner: { width: 36, height: 36, border: "3px solid var(--c-border)", borderTop: "3px solid #f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  joinLoadingText: { fontSize: 14, color: "var(--c-text-3)", margin: 0 },
  joinErrorBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#dc2626" },
  joinRetryRow: { display: "flex" },
};
