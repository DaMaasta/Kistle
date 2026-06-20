import React, { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  FolderOpen, Folder, FileText, File as FileIcon, Image as ImageIcon,
  Plus, Upload, ChevronRight, ChevronLeft, Trash2, X, Check, Pencil,
  AlertTriangle,
} from "lucide-react";
import type { NavigateFn } from "../App";
import { api } from "../config/api";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import {
  subscribeToFolderContents,
  createFolder, renameFolder, deleteFolder,
  uploadFile, deleteFile,
  type DocFolder, type DocFile,
} from "../services/documents.service";

interface DokumenteProps {
  navigate: NavigateFn;
}

interface Breadcrumb { id: string | null; name: string; }

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIconColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#22c55e";
  if (mimeType === "application/pdf") return "#ef4444";
  if (mimeType.includes("word") || mimeType.includes("document")) return "#3b82f6";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "#16a34a";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "#f59e0b";
  return "#94a3b8";
}

function fileIconBg(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#dcfce7";
  if (mimeType === "application/pdf") return "#fee2e2";
  if (mimeType.includes("word") || mimeType.includes("document")) return "#dbeafe";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "#dcfce7";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "#fef3c7";
  return "var(--c-surface-2)";
}

function FileTypeIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }): React.ReactElement {
  const color = fileIconColor(mimeType);
  if (mimeType.startsWith("image/")) return <ImageIcon size={size} color={color} />;
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("document") ||
    mimeType.includes("sheet") || mimeType.includes("presentation"))
    return <FileText size={size} color={color} />;
  return <FileIcon size={size} color={color} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dokumente({ navigate: _navigate }: DokumenteProps): React.ReactElement {
  const { user } = useAuth();
  const { setHeader, clearHeader } = useHeader();

  // Navigation state
  const [folderId, setFolderId] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Breadcrumb[]>([{ id: null, name: "Dokumente" }]);
  const [animKey, setAnimKey]   = useState(0);
  const [animDir, setAnimDir]   = useState<"forward" | "back">("forward");

  // Content
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [files, setFiles] = useState<DocFile[]>([]);

  // Folder creation
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const newFolderActiveRef = useRef(false); // synchronous guard for handleCreateFolder

  // Folder rename
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  // Delete confirmation
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);
  const [deleteFileConfirm, setDeleteFileConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Space-verknüpfte Ordner (für alle Mitglieder sichtbar)
  const [spaceFolders, setSpaceFolders] = useState<(DocFolder & { space_name: string })[]>([]);
  const [sharedRootId, setSharedRootId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<(DocFolder & { space_name: string })[]>('/documents/space-folders')
      .then(setSpaceFolders).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToFolderContents(user.uid, folderId, ({ folders, files }) => {
      setFolders(folders);
      setFiles(files);
    });
  }, [user, folderId]);

  // Header-Titel bei Ordner-Navigation setzen
  useEffect(() => {
    if (crumbs.length > 1) {
      const current = crumbs[crumbs.length - 1];
      setHeader({
        title: current.name,
        onBack: () => goToCrumb(crumbs.length - 2),
      });
    } else {
      clearHeader();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crumbs]);

  // Auto-clear delete confirmations after 3s
  useEffect(() => {
    if (!deleteFolderConfirm && !deleteFileConfirm) return;
    const t = setTimeout(() => {
      setDeleteFolderConfirm(null);
      setDeleteFileConfirm(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [deleteFolderConfirm, deleteFileConfirm]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const enterFolder = (folder: DocFolder) => {
    newFolderActiveRef.current = false;
    setAnimDir("forward");
    setAnimKey((k) => k + 1);
    setFolderId(folder.id);
    setCrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    if (visibleSpaceFolders.some(sf => sf.id === folder.id)) setSharedRootId(folder.id);
    setEditingFolderId(null);
    setDeleteFolderConfirm(null);
    setDeleteFileConfirm(null);
    setShowNewFolder(false);
    setNewFolderName("");
  };

  const goToCrumb = (index: number) => {
    newFolderActiveRef.current = false;
    setAnimDir("back");
    setAnimKey((k) => k + 1);
    const crumb = crumbs[index];
    setFolderId(crumb.id);
    setCrumbs((prev) => prev.slice(0, index + 1));
    setShowNewFolder(false);
    setNewFolderName("");
  };

  // ── Folder actions ──────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim() || creating || !newFolderActiveRef.current) return;
    newFolderActiveRef.current = false;
    const name = newFolderName.trim();
    const parentId = folderId;
    setCreating(true);
    setDeleteError(null);
    try {
      await createFolder(user.uid, name, parentId);
      setNewFolderName("");
      setShowNewFolder(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Ordner erstellen fehlgeschlagen");
      newFolderActiveRef.current = true;
    } finally {
      setCreating(false);
    }
  };

  const startRename = (folder: DocFolder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setDeleteFolderConfirm(null);
  };

  const handleRename = async () => {
    if (!editingFolderId || !editFolderName.trim()) return;
    await renameFolder(editingFolderId, editFolderName.trim());
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (folder: DocFolder) => {
    if (deleteFolderConfirm !== folder.id) { setDeleteFolderConfirm(folder.id); return; }
    setDeleteFolderConfirm(null);
    setDeleteError(null);
    try {
      await deleteFolder(folder.id);
    } catch {
      setDeleteError(`Ordner „${folder.name}" konnte nicht gelöscht werden.`);
    }
  };

  // ── File actions ────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      await uploadFile(user.uid, file, folderId, setUploadProgress);
    } catch {
      setUploadError("Upload fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleOpenFile = async (file: DocFile) => {
    try {
      const filename = file.url.split('/').pop() ?? '';
      const blob = await api.blob(`/documents/serve/${filename}`);
      const objectUrl = URL.createObjectURL(blob);
      if (file.mimeType.startsWith("image/")) {
        setPreviewUrl(objectUrl);
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      }
    } catch {
      // fallback: direct open
      window.open(file.url, "_blank");
    }
  };

  const handleDeleteFile = async (file: DocFile) => {
    if (deleteFileConfirm !== file.id) { setDeleteFileConfirm(file.id); return; }
    setDeleteFileConfirm(null);
    setDeleteError(null);
    try {
      await deleteFile(file.id);
    } catch {
      setDeleteError(`Datei „${file.name}" konnte nicht gelöscht werden.`);
    }
  };

  // Eigene Ordner-IDs — Space-Ordner die der User selbst besitzt nicht doppelt anzeigen
  const ownFolderIds = new Set(folders.map(f => f.id));
  const visibleSpaceFolders = folderId === null
    ? spaceFolders.filter(sf => !ownFolderIds.has(sf.id))
    : [];

  const isEmpty = folders.length === 0 && files.length === 0 && visibleSpaceFolders.length === 0;
  const isReadOnly = sharedRootId !== null && crumbs.some(c => c.id === sharedRootId);

  return (
    <div style={styles.container}>

      {/* Image preview modal */}
      {previewUrl && (
        <div style={styles.previewOverlay} onClick={() => setPreviewUrl(null)}>
          <button style={styles.previewClose} onClick={() => setPreviewUrl(null)}>
            <X size={20} color="#fff" />
          </button>
          <img
            src={previewUrl}
            alt="Vorschau"
            style={styles.previewImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Header */}
      <div style={styles.topRow}>
        <div style={styles.headerBtns}>
          {!isReadOnly && (
            <button
              style={styles.outlineBtn}
              onClick={() => { newFolderActiveRef.current = true; setShowNewFolder(true); setNewFolderName(""); }}
              title="Neuer Ordner"
            >
              <Plus size={15} color="var(--c-dark-btn-text)" />
              <span style={styles.btnLabel}>Ordner</span>
            </button>
          )}
          {!isReadOnly && (
            <button
              style={styles.solidBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Datei hochladen"
            >
              <Upload size={15} color="var(--c-dark-btn-text)" />
              <span style={styles.btnLabelWhite}>Hochladen</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      {crumbs.length > 1 && (
        <div style={styles.breadcrumbs}>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id ?? "root"}>
              {i > 0 && <ChevronRight size={11} color="var(--c-text-4)" />}
              <button
                style={{
                  ...styles.crumb,
                  color: i === crumbs.length - 1 ? "var(--c-text-1)" : "var(--c-text-3)",
                  fontWeight: i === crumbs.length - 1 ? 700 : 500,
                  cursor: i === crumbs.length - 1 ? "default" : "pointer",
                }}
                onClick={() => i < crumbs.length - 1 && goToCrumb(i)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* New folder input */}
      {showNewFolder && (
        <div style={styles.newFolderCard}>
          <Folder size={17} color="#2C2926" />
          <input
            style={styles.newFolderInput}
            placeholder="Ordnername…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { newFolderActiveRef.current = false; setShowNewFolder(false); }
            }}
            autoFocus
          />
          <button style={styles.smallBtn} onClick={() => { newFolderActiveRef.current = false; setShowNewFolder(false); }}>
            <X size={14} color="var(--c-text-3)" />
          </button>
          <button style={styles.smallBtn} onClick={handleCreateFolder} disabled={creating}>
            <Check size={14} color="#2C2926" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div style={styles.progressWrap}>
          <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
          <span style={styles.progressText}>Hochladen… {Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div style={styles.errorBox}>
          <AlertTriangle size={14} color="#dc2626" />
          <span>{deleteError}</span>
          <button style={styles.smallBtn} onClick={() => setDeleteError(null)}>
            <X size={13} color="#dc2626" />
          </button>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={styles.errorBox}>
          <AlertTriangle size={14} color="#dc2626" />
          <span>{uploadError}</span>
          <button style={styles.smallBtn} onClick={() => setUploadError(null)}>
            <X size={13} color="#dc2626" />
          </button>
        </div>
      )}

      {/* Animated content */}
      <div key={animKey} className={`page-${animDir}`}>

      {/* Empty state */}
      {isEmpty && !showNewFolder ? (
        <div style={styles.empty}>
          <FolderOpen size={44} color="var(--c-border)" />
          <p style={styles.emptyTitle}>Noch leer</p>
          <p style={styles.emptyText}>
            Erstelle einen Ordner oder lade eine Datei hoch.
          </p>
        </div>
      ) : (
        <div style={styles.list}>

          {/* Lager-verknüpfte Ordner (nur im Root sichtbar, keine eigenen doppelt) */}
          {visibleSpaceFolders.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Lager-Ordner</div>
              {visibleSpaceFolders.map((sf) => (
                <div key={sf.id} style={styles.row}>
                  <button style={styles.rowMain} onClick={() => enterFolder(sf)}>
                    <div style={{ ...styles.folderIconBox, background: "var(--c-accent-bg)" }}>
                      <FolderOpen size={19} color="#2C2926" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" as const, flex: 1, minWidth: 0 }}>
                      <span style={styles.rowName}>{sf.name}</span>
                      <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{sf.space_name}</span>
                    </div>
                    <ChevronRight size={15} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
                  </button>
                </div>
              ))}
              {(folders.length > 0 || files.length > 0) && <div style={styles.divider} />}
            </>
          )}

          {/* Folders */}
          {folders.map((folder) => (
            <div key={folder.id} style={styles.row}>
              {editingFolderId === folder.id ? (
                /* Rename mode */
                <div style={styles.renameRow}>
                  <Folder size={17} color="#2C2926" style={{ flexShrink: 0 }} />
                  <input
                    style={styles.renameInput}
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                    autoFocus
                  />
                  <button style={styles.smallBtn} onClick={() => setEditingFolderId(null)}>
                    <X size={14} color="var(--c-text-3)" />
                  </button>
                  <button style={styles.smallBtn} onClick={handleRename}>
                    <Check size={14} color="#22c55e" />
                  </button>
                </div>
              ) : (
                /* Normal folder row */
                <>
                  <button style={styles.rowMain} onClick={() => enterFolder(folder)}>
                    <div style={styles.folderIconBox}>
                      <Folder size={19} color="#2C2926" />
                    </div>
                    <span style={styles.rowName}>{folder.name}</span>
                    <ChevronRight size={15} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
                  </button>
                  {!isReadOnly && (
                    <div style={styles.rowActions}>
                      <button
                        style={styles.actionBtn}
                        onClick={() => startRename(folder)}
                        title="Umbenennen"
                      >
                        <Pencil size={14} color="var(--c-text-3)" />
                      </button>
                      <button
                        style={{
                          ...styles.actionBtn,
                          background: deleteFolderConfirm === folder.id ? "#fee2e2" : "none",
                        }}
                        onClick={() => handleDeleteFolder(folder)}
                        title="Löschen"
                      >
                        <Trash2 size={14} color={deleteFolderConfirm === folder.id ? "#ef4444" : "var(--c-text-4)"} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Divider between folders and files */}
          {folders.length > 0 && files.length > 0 && (
            <div style={styles.divider} />
          )}

          {/* Files */}
          {files.map((file) => (
            <div key={file.id} style={styles.row}>
              <button
                style={styles.rowMain}
                onClick={() => handleOpenFile(file)}
              >
                <div style={{ ...styles.fileIconBox, background: fileIconBg(file.mimeType) }}>
                  <FileTypeIcon mimeType={file.mimeType} />
                </div>
                <div style={styles.fileInfo}>
                  <span style={styles.rowName}>{file.name}</span>
                  <span style={styles.fileMeta}>{formatSize(file.size)}</span>
                </div>
              </button>
              {!isReadOnly && (
                <div style={styles.rowActions}>
                  <button
                    style={{
                      ...styles.actionBtn,
                      background: deleteFileConfirm === file.id ? "#fee2e2" : "none",
                    }}
                    onClick={() => handleDeleteFile(file)}
                    title="Löschen"
                  >
                    <Trash2 size={14} color={deleteFileConfirm === file.id ? "#ef4444" : "var(--c-text-4)"} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Back button */}
      {crumbs.length > 1 && (
        <button style={styles.backBtn} onClick={() => goToCrumb(crumbs.length - 2)}>
          <ChevronLeft size={15} color="var(--c-text-2)" />
          Zurück zu „{crumbs[crumbs.length - 2].name}"
        </button>
      )}

      </div>{/* end animated content */}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px", width: "100%", boxSizing: "border-box" },

  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 16 },

  headerBtns: { display: "flex", gap: 8, marginTop: 6, flexShrink: 0 },
  outlineBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--c-dark-btn)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer" },
  solidBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--c-dark-btn)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer" },
  btnLabel: { fontSize: 12, fontWeight: 600, color: "var(--c-dark-btn-text)" },
  btnLabelWhite: { fontSize: 12, fontWeight: 600, color: "var(--c-dark-btn-text)" },

  breadcrumbs: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 12 },
  crumb: { background: "none", border: "none", fontSize: 13, padding: "2px 0" },

  newFolderCard: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--c-surface)", borderRadius: 14, padding: "11px 14px",
    marginBottom: 8,
    border: "1.5px solid #2C2926",
  },
  newFolderInput: {
    flex: 1, border: "none", outline: "none", fontSize: 14,
    background: "transparent", color: "var(--c-text-1)",
  },
  smallBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: 4, display: "flex", alignItems: "center", borderRadius: 6,
  },

  progressWrap: {
    position: "relative", height: 34, background: "var(--c-surface)",
    borderRadius: 10, overflow: "hidden", marginBottom: 10,
    display: "flex", alignItems: "center",
  },
  progressFill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    background: "linear-gradient(90deg, #2C2926 0%, #2C2926 100%)",
    transition: "width 0.2s ease",
  },
  progressText: {
    position: "relative", fontSize: 12, fontWeight: 600,
    color: "var(--c-text-1)", padding: "0 14px",
  },

  errorBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 10, padding: "10px 12px", marginBottom: 10,
    fontSize: 13, color: "#dc2626",
  },

  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "60px 20px", gap: 8, textAlign: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "var(--c-text-2)", margin: 0 },
  emptyText: { fontSize: 13, color: "var(--c-text-3)", maxWidth: 240, margin: 0 },

  list: { display: "flex", flexDirection: "column", gap: 10 },

  row: {
    display: "flex", alignItems: "center",
    background: "var(--c-surface)", borderRadius: 14,
    overflow: "hidden",
    minHeight: 56,
  },
  rowMain: {
    flex: 1, display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", background: "none", border: "none",
    cursor: "pointer", textAlign: "left", minWidth: 0,
  },
  rowName: {
    flex: 1, fontSize: 14, fontWeight: 600, color: "var(--c-text-1)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  rowActions: { display: "flex", alignItems: "center", paddingRight: 4, gap: 2, flexShrink: 0 },
  actionBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: 8, display: "flex", alignItems: "center", borderRadius: 8,
    transition: "background 0.15s",
  },

  folderIconBox: {
    width: 38, height: 38, borderRadius: 10,
    background: "var(--c-accent-bg)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  fileIconBox: {
    width: 38, height: 38, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  fileInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  fileMeta: { fontSize: 11, color: "var(--c-text-3)" },

  divider: { height: 1, background: "var(--c-border-2)", margin: "4px 0" },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.06em", padding: "8px 0 4px", textTransform: "uppercase" as const },

  renameRow: {
    flex: 1, display: "flex", alignItems: "center", gap: 10,
    padding: "10px 14px", border: "1.5px solid #2C2926", borderRadius: 14,
    background: "var(--c-surface)",
  },
  renameInput: {
    flex: 1, border: "none", outline: "none", fontSize: 14,
    background: "transparent", color: "var(--c-text-1)",
  },

  backBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "none", border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600, color: "var(--c-text-2)",
    marginTop: 20, padding: 0,
  },

  previewOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  previewClose: {
    position: "absolute", top: 20, right: 20,
    background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10,
    width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  previewImg: {
    maxWidth: "100%", maxHeight: "80vh",
    borderRadius: 12,
    objectFit: "contain",
  },
};
