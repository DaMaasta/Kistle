import React, { useState, useEffect, useRef, CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Package, UserPlus, Users, Plus, Pencil, Trash2, Check, X, ChevronDown, Clock, QrCode, Copy, ExternalLink, Mail, Inbox } from "lucide-react";
import QRCodeLib from "qrcode";
import type { NavigateFn, PageParams } from "../App";
import type { Space, SpaceMember, Booking } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToChildSpaces, createSpace, updateSpace, deleteSpace, addMember } from "../services/spaces.service";
import { subscribeToGroupBookings } from "../services/bookings.service";
import { subscribeToSpaceProducts } from "../services/products.service";

type Tab = "Boxen" | "Mitglieder" | "Verlauf";

interface GroupDetailProps {
  navigate: NavigateFn;
  params: PageParams;
}

export default function GroupDetail({ navigate, params }: GroupDetailProps): React.ReactElement {
  const group = params.group as Space;
  const { user } = useAuth();

  const [activeTab, setActiveTab]   = useState<Tab>("Boxen");
  const [boxes, setBoxes]           = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [creating, setCreating]     = useState(false);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [unboxedCount, setUnboxedCount] = useState(0);
  const [showQR, setShowQR]           = useState(false);
  const [copied, setCopied]           = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteList, setInviteList]   = useState<string[]>([]);
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState("");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!group?.id) return;
    return subscribeToChildSpaces(group.id, setBoxes);
  }, [group?.id]);

  useEffect(() => {
    if (!group?.id) return;
    return subscribeToGroupBookings(group.id, setBookings);
  }, [group?.id]);

  useEffect(() => {
    if (!group?.id) return;
    return subscribeToSpaceProducts(group.id, (products) => setUnboxedCount(products.length));
  }, [group?.id]);

  const inviteUrl = group?.id
    ? `${window.location.origin}${window.location.pathname}?invite=${group.id}`
    : "";

  useEffect(() => {
    if (!showQR || !qrCanvasRef.current || !inviteUrl) return;
    QRCodeLib.toCanvas(qrCanvasRef.current, inviteUrl, {
      width: 220,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }, [showQR, inviteUrl]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addEmailToList = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (inviteList.includes(email)) { setInviteEmail(""); return; }
    setInviteList((prev) => [...prev, email]);
    setInviteEmail("");
    setInviteError("");
    inviteInputRef.current?.focus();
  };

  const removeEmail = (email: string) => setInviteList((prev) => prev.filter((e) => e !== email));

  const handleInvite = async () => {
    if (inviteList.length === 0 || inviting) return;
    setInviting(true);
    setInviteError("");
    try {
      await Promise.all(inviteList.map((email) => addMember(group.id, email, "member")));
      setInviteList([]);
      setShowInvite(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Fehler beim Einladen.");
    } finally {
      setInviting(false);
    }
  };

  const members: SpaceMember[] = Object.values(group?.members ?? {});

  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    try {
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "box", parentId: group.id,
        description: "", icon: "📦", color: "#f97316",
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

  const tabs: Tab[] = ["Boxen", "Mitglieder", "Verlauf"];

  return (
    <div style={styles.container}>

      {/* QR-Code Modal */}
      {showQR && (
        <div style={styles.modalOverlay} onClick={() => setShowQR(false)}>
          <div style={styles.qrModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.qrModalHeader}>
              <span style={styles.qrModalTitle}>Einladungslink</span>
              <button style={styles.qrClose} onClick={() => setShowQR(false)}><X size={18} color="#94a3b8" /></button>
            </div>
            <p style={styles.qrModalSub}>
              Scanne den QR-Code oder teile den Link. Neue Nutzer werden zur Registrierung weitergeleitet und landen danach direkt in dieser Gruppe.
            </p>
            <div style={styles.qrBox}>
              <canvas ref={qrCanvasRef} style={{ borderRadius: 12 }} />
            </div>
            <div style={styles.qrLinkRow}>
              <span style={styles.qrLinkText} title={inviteUrl}>{inviteUrl}</span>
            </div>
            <div style={styles.qrActions}>
              <button style={styles.qrCopyBtn} onClick={handleCopyLink}>
                <Copy size={14} />
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
              <button style={styles.qrOpenBtn} onClick={() => window.open(inviteUrl, "_blank")}>
                <ExternalLink size={14} />
                Öffnen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Einladen Modal */}
      {showInvite && (
        <div style={styles.modalOverlay} onClick={() => setShowInvite(false)}>
          <div style={styles.inviteModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.inviteHeader}>
              <div style={styles.inviteHeaderLeft}>
                <div style={styles.inviteHeaderIcon}><UserPlus size={16} color="#f97316" /></div>
                <span style={styles.inviteTitle}>Mitglieder einladen</span>
              </div>
              <button style={styles.qrClose} onClick={() => setShowInvite(false)}><X size={18} color="#94a3b8" /></button>
            </div>

            <label style={styles.inviteLabel}>E-Mail-Adressen</label>
            <div style={styles.inviteInputRow}>
              <input
                ref={inviteInputRef}
                style={styles.inviteInput}
                type="email"
                placeholder="name@email.de"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmailToList()}
                autoFocus
              />
              <button style={styles.inviteAddBtn} onClick={addEmailToList} type="button">
                <Mail size={16} color={inviteEmail.includes("@") ? "#f97316" : "#cbd5e1"} />
              </button>
            </div>

            {inviteList.length > 0 && (
              <div style={styles.chipRow}>
                {inviteList.map((email) => (
                  <div key={email} style={styles.chip}>
                    <span style={styles.chipText}>{email}</span>
                    <button style={styles.chipRemove} onClick={() => removeEmail(email)}><X size={11} color="#f97316" /></button>
                  </div>
                ))}
              </div>
            )}

            {inviteError && <div style={styles.inviteError}>{inviteError}</div>}

            <div style={styles.inviteActions}>
              <button style={styles.inviteCancelBtn} onClick={() => setShowInvite(false)}>Abbrechen</button>
              <button
                style={{ ...styles.inviteConfirmBtn, opacity: inviteList.length === 0 || inviting ? 0.5 : 1 }}
                onClick={handleInvite}
                disabled={inviteList.length === 0 || inviting}
              >
                {inviting ? "Lädt…" : `${inviteList.length} einladen`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zurück */}
      <button style={styles.back} onClick={() => navigate("Groups")}>
        <ChevronLeft size={16} color="#f97316" />
        <span style={styles.backText}>Zurück zu Gruppen</span>
      </button>

      {/* Header */}
      <div style={styles.groupHeader}>
        <div style={styles.groupTitleRow}>
          <span style={{ ...styles.groupDot, background: group?.color ?? "#f97316" }} />
          <h1 style={styles.groupName}>{group?.name ?? "Gruppe"}</h1>
        </div>
        <div style={styles.actions}>
          <button style={styles.actionBtn} onClick={() => setShowQR(true)}>
            <QrCode size={14} /> Einladungslink
          </button>
          <button style={styles.actionBtn} onClick={() => { setShowInvite(true); setInviteList([]); setInviteEmail(""); setInviteError(""); }}>
            <UserPlus size={14} /> Direkt einladen
          </button>
          <button style={styles.primaryBtn} onClick={() => { setShowCreate(true); setActiveTab("Boxen"); }}>
            <Plus size={14} /> Box erstellen
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabRow}>
        {tabs.map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "Boxen" ? <Package size={14} /> : tab === "Mitglieder" ? <Users size={14} /> : <Clock size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Boxen */}
      {activeTab === "Boxen" && (
        <>
          {showCreate && (
            <div style={styles.createCard}>
              <input style={styles.createInput} placeholder="Box-Name..." value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
              <div style={styles.createActions}>
                <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); }}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
                  {creating ? "…" : "Erstellen"}
                </button>
              </div>
            </div>
          )}

          {boxes.length === 0 && !showCreate ? (
            <div style={styles.emptyState}>
              <Package size={48} color="var(--c-border)" />
              <p style={styles.emptyText}>Noch keine Boxen in dieser Gruppe</p>
              <button style={styles.emptyBtn} onClick={() => setShowCreate(true)}>
                <Plus size={14} color="#f97316" /> Erste Box erstellen
              </button>
            </div>
          ) : (
            <div style={styles.boxGrid}>
              {boxes.map((box) => (
                <div key={box.id}>
                  {editingId === box.id ? (
                    <div style={styles.editCard}>
                      <input style={styles.editInput} value={editName}
                        onChange={(e) => setEditName(e.target.value)}
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
                      <button style={styles.boxClickable}
                        onClick={() => navigate("BoxDetail", { box, place: group })}>
                        <div style={styles.boxTop}>
                          <Package size={22} color="#f97316" />
                          <ChevronRight size={14} color="var(--c-text-4)" />
                        </div>
                        <div style={styles.boxName}>{box.name}</div>
                        <div style={styles.boxSub}>{box.description || "Box"}</div>
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
            onClick={() => navigate("UnboxedDetail", { space: group, from: "GroupDetail", fromParam: { group } })}
          >
            <div style={styles.unboxedIcon}><Inbox size={20} color="#f97316" /></div>
            <div style={styles.unboxedInfo}>
              <div style={styles.unboxedTitle}>Unboxed Items</div>
              <div style={styles.unboxedSub}>{unboxedCount} Gegenstand{unboxedCount !== 1 ? "e" : ""}</div>
            </div>
            <ChevronRight size={16} color="var(--c-text-4)" />
          </button>
        </>
      )}

      {/* Tab: Mitglieder */}
      {activeTab === "Mitglieder" && (
        <div style={styles.memberList}>
          {members.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>Noch keine weiteren Mitglieder</p>
            </div>
          ) : (
            members.map((m) => {
              const initials = m.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div key={m.userId} style={styles.memberItem}>
                  <div style={styles.memberAvatar}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.memberName}>{m.displayName}</div>
                    <div style={styles.memberEmail}>{m.email}</div>
                  </div>
                  <span style={styles.roleBadge}>{m.role === "owner" ? "Admin" : m.role}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Verlauf */}
      {activeTab === "Verlauf" && (
        <div style={styles.historyList}>
          {bookings.length === 0 ? (
            <div style={styles.emptyState}>
              <Clock size={40} color="var(--c-border)" />
              <p style={styles.emptyText}>Noch keine Abbuchungen</p>
            </div>
          ) : (
            bookings.map((b) => {
              const isOpen    = expandedId === b.id;
              const name      = b.userDisplayName || b.userEmail;
              const initials  = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
              const dateStr   = b.createdAt.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
              const timeStr   = b.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={b.id} style={styles.bookingCard}>
                  <button style={styles.bookingHeader} onClick={() => setExpandedId(isOpen ? null : b.id)}>
                    <div style={styles.bookingAvatar}>{initials}</div>
                    <div style={styles.bookingInfo}>
                      <div style={styles.bookingUser}>{name}</div>
                      <div style={styles.bookingDate}>{dateStr} · {timeStr}</div>
                    </div>
                    <div style={styles.bookingRight}>
                      <span style={styles.bookingCount}>{b.items.length} Artikel</span>
                      <ChevronDown
                        size={16}
                        color="var(--c-text-3)"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                      />
                    </div>
                  </button>
                  {isOpen && (
                    <div style={styles.bookingItems}>
                      {b.items.map((item, idx) => (
                        <div
                          key={idx}
                          style={{ ...styles.bookingItemRow, borderBottom: idx < b.items.length - 1 ? "1px solid var(--c-border-2)" : "none" }}
                        >
                          <span style={styles.bookingItemName}>{item.productName}</span>
                          <span style={styles.bookingItemQty}>{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16 },
  backText: { color: "#f97316", fontSize: 14, fontWeight: 600 },
  groupHeader: { marginBottom: 16 },
  groupTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 16 },
  groupDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  groupName: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: 0, marginRight: 4 },
  actions: { display: "flex", flexWrap: "nowrap" as const, gap: 8, overflowX: "auto" as const },
  actionBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--c-surface)", border: "1.5px solid var(--c-border)", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 600, color: "var(--c-text-1)", cursor: "pointer", whiteSpace: "nowrap" as const },
  primaryBtn: { display: "flex", alignItems: "center", gap: 5, background: "#0f172a", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" as const },
  tabRow: { display: "flex", gap: 6, marginBottom: 16, background: "var(--c-surface-2)", borderRadius: 12, padding: 4 },
  tab: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", borderRadius: 9, padding: "8px 4px", fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", cursor: "pointer" },
  tabActive: { background: "var(--c-surface)", color: "var(--c-text-1)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  createInput: { width: "100%", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--c-bg)", color: "var(--c-text-1)" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  saveBtn: { background: "#f97316", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  emptyState: { textAlign: "center", padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)" },
  emptyBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-accent-bg)", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#f97316", cursor: "pointer" },
  boxGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  boxCard: { background: "var(--c-surface)", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" },
  boxClickable: { display: "block", width: "100%", padding: "12px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  boxTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  boxName: { fontSize: 13, fontWeight: 700, color: "var(--c-text-1)", marginBottom: 2 },
  boxSub: { fontSize: 11, color: "var(--c-text-3)" },
  boxActions: { display: "flex", justifyContent: "flex-end", gap: 2, padding: "0 4px 6px" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 5, display: "flex", alignItems: "center" },
  editCard: { background: "var(--c-surface)", borderRadius: 14, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  editInput: { width: "100%", border: "1px solid #f97316", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)", boxSizing: "border-box" },
  editActions: { display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" },
  deleteCard: { background: "var(--c-surface)", borderRadius: 14, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8 },
  deleteText: { fontSize: 12, color: "var(--c-text-1)", fontWeight: 500 },
  confirmDeleteBtn: { background: "#ef4444", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff" },
  memberList: { display: "flex", flexDirection: "column", gap: 10 },
  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  unboxedCard: { width: "100%", display: "flex", alignItems: "center", gap: 14, background: "var(--c-surface)", borderRadius: 16, padding: "16px", border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 4 },
  unboxedIcon: { width: 44, height: 44, borderRadius: 12, background: "var(--c-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  unboxedInfo: { flex: 1 },
  unboxedTitle: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" },
  unboxedSub: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  qrModal: { background: "#fff", borderRadius: 24, padding: "24px 20px", width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  qrModalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  qrModalTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  qrClose: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 },
  qrModalSub: { fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: 0 },
  qrBox: { display: "flex", justifyContent: "center", background: "#f8fafc", borderRadius: 16, padding: 16 },
  qrLinkRow: { background: "#f1f5f9", borderRadius: 10, padding: "8px 12px" },
  qrLinkText: { fontSize: 11, color: "#475569", wordBreak: "break-all" as const, display: "block" },
  qrActions: { display: "flex", gap: 8 },
  qrCopyBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  qrOpenBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  bookingCard: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  bookingHeader: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  bookingAvatar: { width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  bookingInfo: { flex: 1, minWidth: 0 },
  bookingUser: { fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" },
  bookingDate: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2 },
  bookingRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  bookingCount: { fontSize: 11, fontWeight: 600, color: "#f97316", background: "var(--c-accent-bg)", borderRadius: 6, padding: "2px 7px" },
  bookingItems: { borderTop: "1px solid var(--c-border-2)", padding: "4px 16px 12px" },
  bookingItemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" },
  bookingItemName: { fontSize: 13, color: "var(--c-text-1)" },
  bookingItemQty: { fontSize: 13, fontWeight: 700, color: "#f97316" },
  memberItem: { display: "flex", alignItems: "center", gap: 12, background: "var(--c-surface)", borderRadius: 14, padding: 14 },
  memberAvatar: { width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 },
  memberName: { fontSize: 14, fontWeight: 600, color: "var(--c-text-1)" },
  memberEmail: { fontSize: 12, color: "var(--c-text-3)" },
  roleBadge: { marginLeft: "auto", background: "var(--c-surface-2)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)" },
  inviteModal: { background: "#fff", borderRadius: 20, padding: "24px 20px", width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  inviteHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  inviteHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  inviteHeaderIcon: { width: 32, height: 32, background: "#fff3e8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  inviteTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  inviteLabel: { fontSize: 13, fontWeight: 600, color: "#475569" },
  inviteInputRow: { display: "flex", alignItems: "center", border: "1.5px solid #f97316", borderRadius: 12, overflow: "hidden", background: "#fff" },
  inviteInput: { flex: 1, border: "none", outline: "none", padding: "12px 14px", fontSize: 14, color: "#0f172a", background: "transparent" },
  inviteAddBtn: { padding: "0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", height: "100%" },
  chipRow: { display: "flex", flexWrap: "wrap" as const, gap: 6 },
  chip: { display: "flex", alignItems: "center", gap: 4, background: "#fff3e8", borderRadius: 20, padding: "4px 10px 4px 12px" },
  chipText: { fontSize: 12, color: "#c2410c", fontWeight: 500 },
  chipRemove: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 1 },
  inviteError: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#dc2626" },
  inviteActions: { display: "flex", gap: 10, marginTop: 4 },
  inviteCancelBtn: { flex: 1, background: "#f1f5f9", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer" },
  inviteConfirmBtn: { flex: 1, background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
};
