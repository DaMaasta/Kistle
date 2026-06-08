import React, { useState, useEffect, useRef, useMemo } from "react";
import BottomSheet from "../components/BottomSheet";
import type { CSSProperties } from "react";
import { ChevronRight, Package, UserPlus, Users, Plus, Minus, Pencil, Trash2, Check, X, ChevronDown, Clock, QrCode, Copy, ExternalLink, Mail, Inbox, MapPin, Undo2 } from "lucide-react";
import QRCodeLib from "qrcode";
import type { NavigateFn, PageParams } from "../App";
import type { Space, SpaceMember, Booking, BookingItem, UserRole } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { subscribeToChildSpaces, subscribeToSpace, createSpace, updateSpace, deleteSpace, addMember, removeMember, updateMemberRole } from "../services/spaces.service";
import { subscribeToGroupBookings, createReturnBooking } from "../services/bookings.service";
import { subscribeToSpaceProducts } from "../services/products.service";
import { getInitials, formatLocation } from "../utils/stringUtils";

type Tab = "Boxen" | "Mitglieder" | "Verlauf";

const BOX_COLORS = ["#FF7648","#ef4444","#eab308","#22c55e","#14b8a6","#3b82f6","#8b5cf6","#ec4899"];

interface GroupDetailProps {
  navigate: NavigateFn;
  params: PageParams;
}

export default function GroupDetail({ navigate, params }: GroupDetailProps): React.ReactElement {
  const initialGroup = params.group as Space;
  const { user } = useAuth();
  const { setHeader } = useHeader();

  const [group, setGroup] = useState<Space>(initialGroup);

  const [activeTab, setActiveTab]   = useState<Tab>("Boxen");
  const [tabDir, setTabDir]         = useState<"forward" | "back">("forward");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabIndicatorLeft, setTabIndicatorLeft] = useState<number | null>(null);
  const [tabIndicatorWidth, setTabIndicatorWidth] = useState(0);
  const [boxes, setBoxes]           = useState<Space[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [creating, setCreating]     = useState(false);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [editColor, setEditColor]   = useState("#FF7648");
  const [newColor, setNewColor]     = useState("#FF7648");
  const [deleteBox, setDeleteBox]   = useState<{ id: string; name: string } | null>(null);
  const [historyFilter, setHistoryFilter] = useState("");
  const [unboxedCount, setUnboxedCount] = useState(0);
  const [inviteTab, setInviteTab]     = useState<'qr' | 'email'>('qr');
  const [copied, setCopied]           = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteList, setInviteList]   = useState<string[]>([]);
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removingId, setRemovingId]       = useState<string | null>(null);
  const [removingError, setRemovingError] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [returnBooking, setReturnBooking] = useState<Booking | null>(null);
  const [returnQtys, setReturnQtys]       = useState<Record<string, number>>({});
  const [returning, setReturning]         = useState(false);
  const [returnError, setReturnError]     = useState<string | null>(null);
  const [returnConfirm, setReturnConfirm] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const submittedReturns = useRef<Set<string>>(new Set());
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const tabs: Tab[] = ["Boxen", "Mitglieder", "Verlauf"];

  useEffect(() => {
    const idx = tabs.indexOf(activeTab);
    const el = tabRefs.current[idx];
    if (el) {
      setTabIndicatorLeft(el.offsetLeft);
      setTabIndicatorWidth(el.offsetWidth);
    }
  }, [activeTab]);

  const handleTabChange = (tab: Tab) => {
    const fromIdx = tabs.indexOf(activeTab);
    const toIdx = tabs.indexOf(tab);
    setTabDir(toIdx > fromIdx ? "forward" : "back");
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!initialGroup?.id) return;
    return subscribeToSpace(initialGroup.id, (updated) => {
      if (updated) {
        setGroup(updated);
        setHeader({ title: updated.name, onBack: () => navigate("Groups") });
      }
    });
  }, [initialGroup?.id]);

  useEffect(() => {
    setHeader({ title: initialGroup?.name ?? "Lager", onBack: () => navigate("Groups") });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialGroup?.id) return;
    return subscribeToChildSpaces(initialGroup.id, setBoxes);
  }, [initialGroup?.id]);

  useEffect(() => {
    if (!initialGroup?.id) return;
    return subscribeToGroupBookings(initialGroup.id, setBookings);
  }, [initialGroup?.id]);

  useEffect(() => {
    if (!initialGroup?.id) return;
    return subscribeToSpaceProducts(initialGroup.id, (products) => setUnboxedCount(products.length));
  }, [initialGroup?.id]);

  const members: SpaceMember[] = Object.values(group?.members ?? {});
  const currentMember = members.find((m) => m.userId === user?.uid);
  const isOwner = group?.ownerId === user?.uid || currentMember?.role === "admin";
  const isViewer = !isOwner && currentMember?.role === "viewer";

  const groupedByDate = useMemo(() => {
    const allSource = isViewer ? bookings.filter((b) => b.userId === user?.uid) : bookings;
    const returnMap = new Map<string, Booking>();
    allSource.forEach((b) => {
      if (b.type === 'return' && b.originalBookingId) returnMap.set(b.originalBookingId, b);
    });
    const source = allSource.filter((b) => b.type !== 'return');
    const dateMap = new Map<string, {
      key: string; label: string; totalCount: number;
      persons: Map<string, { userId: string; name: string; initials: string; entries: Array<{ booking: Booking; number: number; returnBooking?: Booking }> }>;
    }>();
    source.forEach((b, index) => {
      const d = b.createdAt;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dateLabel = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, { key: dateKey, label: dateLabel, totalCount: 0, persons: new Map() });
      const dateEntry = dateMap.get(dateKey)!;
      dateEntry.totalCount++;
      const personName = b.userDisplayName || b.userEmail;
      const personInitials = getInitials(personName) || personName[0]?.toUpperCase() || "?";
      if (!dateEntry.persons.has(b.userId)) {
        dateEntry.persons.set(b.userId, { userId: b.userId, name: personName, initials: personInitials, entries: [] });
      }
      dateEntry.persons.get(b.userId)!.entries.push({ booking: b, number: source.length - index, returnBooking: returnMap.get(b.id) });
    });
    return Array.from(dateMap.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((d) => ({ ...d, persons: Array.from(d.persons.values()) }));
  }, [bookings, isViewer, user?.uid]);

  useEffect(() => {
    if (groupedByDate.length > 0) {
      setExpandedDates((prev) => {
        if (prev.size > 0) return prev;
        return new Set([groupedByDate[0].key]);
      });
    }
  }, [groupedByDate]);

  const toggleDate = (key: string) =>
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const inviteUrl = group?.id
    ? `${window.location.origin}${window.location.pathname}?invite=${group.id}`
    : "";

  useEffect(() => {
    if (!showInvite || inviteTab !== 'qr' || !qrCanvasRef.current || !inviteUrl) return;
    QRCodeLib.toCanvas(qrCanvasRef.current, inviteUrl, {
      width: 160,
      margin: 1,
      color: { dark: "#2d3a52", light: "#e0e5ec" },
    });
  }, [showInvite, inviteTab, inviteUrl]);

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
    setTimeout(() => inviteInputRef.current?.focus(), 0);
  };

  const removeEmail = (email: string) => setInviteList((prev) => prev.filter((e) => e !== email));

  const handleInvite = async () => {
    if (inviteList.length === 0 || inviting || !isOwner) return;
    setInviting(true);
    setInviteError("");
    try {
      await Promise.all(inviteList.map((email) => addMember(group.id, email, email, email, "viewer")));
      setInviteList([]);
      setShowInvite(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Fehler beim Einladen.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!isOwner) return;
    setRemovingError(null);
    try {
      await removeMember(group.id, userId);
    } catch (e) {
      setRemovingError(e instanceof Error ? e.message : "Fehler beim Entfernen.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setUpdatingRoleId(userId);
    try {
      await updateMemberRole(group.id, userId, role);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const openReturn = (b: Booking) => {
    if (submittedReturns.current.has(b.id)) return;
    const qtys: Record<string, number> = {};
    b.items.forEach((item) => { qtys[item.productId] = item.quantity; });
    setReturnBooking(b);
    setReturnQtys(qtys);
    setReturnError(null);
    setReturnConfirm(false);
  };

  const closeReturn = () => {
    if (returnTimerRef.current) { clearTimeout(returnTimerRef.current); returnTimerRef.current = null; }
    setReturnBooking(null); setReturnConfirm(false); setReturnError(null); setReturnSuccess(false);
  };

  const handleReturn = async () => {
    if (!returnBooking || returning || !user) return;
    if (submittedReturns.current.has(returnBooking.id)) return;
    submittedReturns.current.add(returnBooking.id);
    setReturning(true);
    try {
      const filteredItems = returnBooking.items.filter((item) => (returnQtys[item.productId] ?? 0) > 0);
      const bookingItems: BookingItem[] = filteredItems.map((item) => ({ ...item, quantity: returnQtys[item.productId] }));
      await createReturnBooking(returnBooking.id, bookingItems);
      setReturnSuccess(true);
      returnTimerRef.current = setTimeout(closeReturn, 1200);
    } catch (e) {
      submittedReturns.current.delete(returnBooking.id);
      setReturnError(e instanceof Error ? e.message : "Fehler beim Zurückbuchen.");
      setReturnConfirm(false);
    } finally {
      setReturning(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user || creating) return;
    setCreating(true);
    try {
      await createSpace(user.uid, user.email ?? "", user.displayName ?? "", {
        name: newName.trim(), type: "box", parentId: group.id,
        description: newDesc.trim(), icon: "📦", color: newColor,
      });
      setNewName(""); setNewDesc(""); setNewColor("#FF7648"); setShowCreate(false);
    } finally { setCreating(false); }
  };

  const startEdit = (box: Space) => {
    setEditingId(box.id);
    setEditName(box.name);
    setEditDesc(box.description ?? "");
    setEditColor(box.color ?? "#FF7648");
    setDeleteBox(null);
  };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    await updateSpace(editingId, { name: editName.trim(), description: editDesc.trim(), color: editColor });
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteBox) return;
    await deleteSpace(deleteBox.id);
    setDeleteBox(null);
  };

  return (
    <div style={styles.container}>

      {/* Einladen / QR-Sheet (kombiniert) */}
      {showInvite && (
        <BottomSheet onClose={() => setShowInvite(false)}>
          <div style={styles.inviteHeader}>
            <div style={styles.inviteHeaderLeft}>
              <div style={styles.inviteHeaderIcon}><UserPlus size={16} color="#FF7648" /></div>
              <span style={styles.inviteTitle}>Einladen</span>
            </div>
            <button style={styles.qrClose} onClick={() => setShowInvite(false)}><X size={18} color="#94a3b8" /></button>
          </div>

          {/* Tab-Switcher */}
          <div style={styles.inviteTabRow}>
            <button
              style={{ ...styles.inviteTabBtn, ...(inviteTab === 'qr' ? styles.inviteTabActive : {}) }}
              onClick={() => setInviteTab('qr')}
            >
              <QrCode size={14} /> QR-Code
            </button>
            <button
              style={{ ...styles.inviteTabBtn, ...(inviteTab === 'email' ? styles.inviteTabActive : {}) }}
              onClick={() => setInviteTab('email')}
            >
              <Mail size={14} /> E-Mail
            </button>
          </div>

          {inviteTab === 'qr' ? (
            <>
              <p style={styles.qrModalSub}>QR-Code scannen oder Link teilen.</p>
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
            </>
          ) : (
            <>
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
                  <Mail size={16} color={inviteEmail.includes("@") ? "#FF7648" : "#cbd5e1"} />
                </button>
              </div>

              {inviteList.length > 0 && (
                <div style={styles.chipRow}>
                  {inviteList.map((email) => (
                    <div key={email} style={styles.chip}>
                      <span style={styles.chipText}>{email}</span>
                      <button style={styles.chipRemove} onClick={() => removeEmail(email)}><X size={11} color="#FF7648" /></button>
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
            </>
          )}
        </BottomSheet>
      )}

      {/* Zurückbuchen Modal */}
      {returnBooking && (
        <BottomSheet onClose={closeReturn}>
          {!returnConfirm ? (
            <>
              <div style={styles.returnModalHeader}>
                <div style={styles.returnModalTitleRow}>
                  <Undo2 size={18} color="#FF7648" />
                  <span style={styles.returnModalTitle}>Zurückbuchen</span>
                </div>
                <button style={styles.qrClose} onClick={closeReturn}><X size={18} color="#94a3b8" /></button>
              </div>
              <p style={styles.returnModalSub}>Passe die Mengen an und bestätige die Rückbuchung.</p>
              <div style={styles.returnItemsList}>
                {returnBooking.items.map((item) => (
                  <div key={item.productId} style={styles.returnItem}>
                    <div style={styles.returnItemInfo}>
                      <span style={styles.returnItemName}>{item.productName}</span>
                      <span style={styles.returnItemMax}>max. {item.quantity} {item.unit}</span>
                    </div>
                    <div style={styles.returnQtyRow}>
                      <button style={styles.returnQtyBtn}
                        onClick={() => setReturnQtys((q) => ({ ...q, [item.productId]: Math.max(0, (q[item.productId] ?? item.quantity) - 1) }))}>
                        <Minus size={13} />
                      </button>
                      <span style={styles.returnQtyVal}>{returnQtys[item.productId] ?? item.quantity}</span>
                      <button style={styles.returnQtyBtn}
                        onClick={() => setReturnQtys((q) => ({ ...q, [item.productId]: Math.min(item.quantity, (q[item.productId] ?? item.quantity) + 1) }))}>
                        <Plus size={13} />
                      </button>
                      <span style={styles.returnQtyUnit}>{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={styles.returnActions}>
                <button style={styles.returnCancelBtn} onClick={closeReturn}>Abbrechen</button>
                <button
                  style={styles.returnConfirmBtn}
                  onClick={() => setReturnConfirm(true)}
                  disabled={returnBooking.items.every((i) => (returnQtys[i.productId] ?? i.quantity) === 0)}
                >
                  Weiter
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={styles.returnModalHeader}>
                <div style={styles.returnModalTitleRow}>
                  <Undo2 size={18} color="#FF7648" />
                  <span style={styles.returnModalTitle}>Bestätigen</span>
                </div>
                <button style={styles.qrClose} onClick={closeReturn}><X size={18} color="#94a3b8" /></button>
              </div>
              <p style={styles.returnModalSub}>Folgende Gegenstände werden zurückgebucht und der Lagerbestand wiederhergestellt:</p>
              <div style={styles.returnItemsList}>
                {returnBooking.items
                  .filter((i) => (returnQtys[i.productId] ?? i.quantity) > 0)
                  .map((item) => (
                    <div key={item.productId} style={{ ...styles.returnItem, justifyContent: "space-between" }}>
                      <span style={styles.returnItemName}>{item.productName}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#FF7648" }}>
                        {returnQtys[item.productId] ?? item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
              </div>
              {returnError && <div style={styles.returnError}>{returnError}</div>}
              <div style={styles.returnActions}>
                <button style={styles.returnCancelBtn} onClick={() => { setReturnConfirm(false); setReturnError(null); }} disabled={returning || returnSuccess}>Zurück</button>
                <button
                  style={{
                    ...styles.returnConfirmBtn,
                    opacity: returning ? 0.7 : 1,
                    background: returnSuccess ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#FF7648,#e5623a)",
                    transition: "background 0.4s ease",
                  }}
                  onClick={handleReturn}
                  disabled={returning || returnSuccess}
                >
                  {returnSuccess ? "✓ Zurückgebucht" : returning ? "Wird gebucht…" : "Jetzt zurückbuchen"}
                </button>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {/* Box löschen Modal */}
      {deleteBox && (
        <BottomSheet onClose={() => setDeleteBox(null)}>
          <div style={styles.qrModalHeader}>
            <span style={styles.qrModalTitle}>Box löschen?</span>
            <button style={styles.qrClose} onClick={() => setDeleteBox(null)}><X size={18} color="#94a3b8" /></button>
          </div>
          <p style={{ fontSize: 14, color: "var(--c-text-2)", margin: "0 0 4px", lineHeight: 1.5 }}>
            <strong>„{deleteBox.name}"</strong> und alle darin enthaltenen Gegenstände werden unwiderruflich gelöscht.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.inviteCancelBtn} onClick={() => setDeleteBox(null)}>Abbrechen</button>
            <button style={{ ...styles.inviteConfirmBtn, opacity: 1, background: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)" }} onClick={handleDelete}>Löschen</button>
          </div>
        </BottomSheet>
      )}

      {/* Header */}
      <div style={styles.groupHeader}>
        {!isViewer && (
          <div style={styles.actions}>
            <button style={styles.actionBtn} onClick={() => { setShowInvite(true); setInviteList([]); setInviteEmail(""); setInviteError(""); }}>
              <UserPlus size={13} /> Einladen
            </button>
            <button style={styles.primaryBtn} onClick={() => { setShowCreate(true); setActiveTab("Boxen"); }}>
              <Plus size={13} /> Neue Box
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ ...styles.tabRow, position: "relative" }}>
        {tabIndicatorLeft !== null && (
          <div style={{
            position: "absolute", top: 4, left: tabIndicatorLeft,
            width: tabIndicatorWidth, height: "calc(100% - 8px)",
            borderRadius: 9, background: "var(--c-bg)",
            boxShadow: "var(--neu-raised-sm)",
            transition: "left 0.32s cubic-bezier(0.34, 1.3, 0.64, 1), width 0.32s cubic-bezier(0.34, 1.3, 0.64, 1)",
            pointerEvents: "none", zIndex: 0,
          }} />
        )}
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            ref={el => { tabRefs.current[idx] = el; }}
            style={{ ...styles.tab, position: "relative", zIndex: 1, ...(activeTab === tab ? { color: "var(--c-text-1)", fontWeight: 700 } : {}) }}
            onClick={() => handleTabChange(tab)}
          >
            {tab === "Boxen" ? <Package size={14} /> : tab === "Mitglieder" ? <Users size={14} /> : <Clock size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className={`tab-${tabDir}`}>

      {/* Tab: Boxen */}
      {activeTab === "Boxen" && (
        <>
          {showCreate && (
            <div style={styles.createCard}>
              <input style={styles.createInput} placeholder="Box-Name..." value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
              <input style={{ ...styles.createInput, marginTop: 8, fontSize: 13, color: "var(--c-text-2)" }} placeholder="Beschreibung (optional)..." value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              <div style={styles.colorLabel}>Farbe</div>
              <div style={styles.colorRow}>
                {BOX_COLORS.map((c) => (
                  <button key={c} style={{ ...styles.colorSwatch, background: c, boxShadow: newColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none" }} onClick={() => setNewColor(c)} />
                ))}
              </div>
              <div style={styles.createActions}>
                <button style={styles.cancelBtn} onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setNewColor("#FF7648"); }}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
                  {creating ? "…" : "Erstellen"}
                </button>
              </div>
            </div>
          )}

          {boxes.length === 0 && !showCreate ? (
            <div style={styles.emptyState}>
              <Package size={48} color="var(--c-border)" />
              <p style={styles.emptyText}>Noch keine Boxen an diesem Ort</p>
              {!isViewer && (
                <button style={styles.emptyBtn} onClick={() => setShowCreate(true)}>
                  <Plus size={14} color="#FF7648" /> Erste Box erstellen
                </button>
              )}
            </div>
          ) : (
            <div style={styles.boxGrid}>
              {boxes.map((box) => (
                <React.Fragment key={box.id}>
                  {editingId === box.id ? (
                    <div style={styles.editCard}>
                      <input style={styles.editInput} value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingId(null); }} autoFocus
                        placeholder="Box-Name" />
                      <input style={{ ...styles.editInput, marginTop: 8, fontSize: 12, color: "var(--c-text-2)" }}
                        value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Beschreibung (optional)" />
                      <div style={styles.colorLabel}>Farbe</div>
                      <div style={styles.colorRow}>
                        {BOX_COLORS.map((c) => (
                          <button key={c} style={{ ...styles.colorSwatch, background: c, boxShadow: editColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none" }} onClick={() => setEditColor(c)} />
                        ))}
                      </div>
                      <div style={styles.editActions}>
                        <button style={styles.iconBtn} onClick={handleEdit}><Check size={15} color="#22c55e" /></button>
                        <button style={styles.iconBtn} onClick={() => setEditingId(null)}><X size={15} color="var(--c-text-3)" /></button>
                        <button style={styles.iconBtn} onClick={() => { setDeleteBox({ id: box.id, name: box.name }); setEditingId(null); }}><Trash2 size={14} color="#ef4444" /></button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...styles.boxCard, boxShadow: `inset 0 0 0 1px ${box.color ?? "#FF7648"}55, var(--neu-raised-sm)` }}>
                      <button style={styles.boxClickable}
                        onClick={() => navigate("BoxDetail", { box, place: group })}>
                        <div style={styles.boxTop}>
                          <Package size={22} color={box.color ?? "#FF7648"} />
                          <ChevronRight size={14} color="var(--c-text-4)" />
                        </div>
                        <div style={styles.boxName}>{box.name}</div>
                        <div style={styles.boxSub}>{box.description || "Box"}</div>
                      </button>
                      <div style={styles.boxActions}>
                        {!isViewer && <button style={styles.iconBtn} onClick={() => startEdit(box)}><Pencil size={13} color="var(--c-text-3)" /></button>}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
          {/* Unboxed Items Karte */}
          <button
            style={styles.unboxedCard}
            onClick={() => navigate("UnboxedDetail", { space: group, from: "GroupDetail", fromParam: { group } })}
          >
            <div style={styles.unboxedIcon}><Inbox size={20} color="#FF7648" /></div>
            <div style={styles.unboxedInfo}>
              <div style={styles.unboxedTitle}>Ohne Box</div>
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
              <p style={styles.emptyText}>Noch keine Mitglieder</p>
            </div>
          ) : (
            members.map((m) => {
              const initials = getInitials(m.displayName);
              const isCurrentUser = m.userId === user?.uid;
              const isMemberAdmin = m.role === "admin";
              const canManage = isOwner && !isCurrentUser;
              const isConfirmingRemove = removingId === m.userId;
              const isUpdatingRole = updatingRoleId === m.userId;
              const roleLabel = m.role === "admin" ? "Administrator" : m.role === "editor" ? "Mitarbeiter" : "Beobachter";

              return (
                <div key={m.userId} style={styles.memberItem}>
                  <div style={styles.memberAvatar}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.memberName}>
                      {m.displayName || m.email}
                      {isCurrentUser && <span style={styles.youBadge}>Du</span>}
                    </div>
                    <div style={styles.memberEmail}>{m.email}</div>
                  </div>

                  {canManage ? (
                    isConfirmingRemove ? (
                      <div style={styles.removeConfirm}>
                        <span style={styles.removeQuestion}>Entfernen?</span>
                        <button style={styles.confirmRemoveBtn} onClick={() => handleRemoveMember(m.userId)}>Ja</button>
                        <button style={styles.cancelSmallBtn} onClick={() => setRemovingId(null)}>Nein</button>
                      </div>
                    ) : (
                      <div style={styles.memberActions}>
                        <select
                          style={{ ...styles.roleSelect, opacity: isUpdatingRole ? 0.5 : 1 }}
                          value={m.role}
                          disabled={isUpdatingRole || isMemberAdmin}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as UserRole)}
                        >
                          <option value="admin">Administrator</option>
                          <option value="editor">Mitarbeiter</option>
                          <option value="viewer">Beobachter</option>
                        </select>
                        {!isMemberAdmin && (
                          <button style={styles.removeBtn} onClick={() => setRemovingId(m.userId)} title="Mitglied entfernen">
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <span style={styles.roleBadge}>{roleLabel}</span>
                  )}
                </div>
              );
            })
          )}
          {removingError && (
            <div style={{ padding: "8px 14px", fontSize: 13, color: "#ef4444", background: "#fef2f2", borderRadius: 10, margin: "8px 0" }}>
              {removingError}
            </div>
          )}
        </div>
      )}

      {/* Tab: Verlauf */}
      {activeTab === "Verlauf" && (
        <div style={styles.historyList}>
          {groupedByDate.length > 0 && (
            <input
              style={styles.historySearch}
              placeholder="Nach Person filtern…"
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
            />
          )}
          {(() => {
            const filtered = historyFilter.trim()
              ? groupedByDate
                .map((dg) => ({ ...dg, persons: dg.persons.filter((p) => p.name.toLowerCase().includes(historyFilter.toLowerCase())) }))
                .filter((dg) => dg.persons.length > 0)
              : groupedByDate;
            return filtered.length === 0 ? (
            <div style={styles.emptyState}>
              <Clock size={40} color="var(--c-border)" />
              <p style={styles.emptyText}>Noch keine Abbuchungen</p>
            </div>
          ) : (
            filtered.map((dateGroup) => {
              const isDateOpen = expandedDates.has(dateGroup.key);
              return (
                <div key={dateGroup.key} style={styles.dateGroup}>
                  <button style={styles.dateHeader} onClick={() => toggleDate(dateGroup.key)}>
                    <span style={styles.dateLabelText}>{dateGroup.label}</span>
                    <div style={styles.dateRight}>
                      <span style={styles.dateCount}>{dateGroup.totalCount} Buchung{dateGroup.totalCount !== 1 ? "en" : ""}</span>
                      <ChevronDown
                        size={16}
                        color="var(--c-text-3)"
                        style={{ transform: isDateOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                      />
                    </div>
                  </button>
                  {isDateOpen && (
                    <div style={styles.dateEntries}>
                      {dateGroup.persons.map((person) => (
                        <div key={person.userId} style={styles.personGroup}>
                          <div style={styles.personLabel}>
                            <div style={styles.personLabelAvatar}>{person.initials}</div>
                            <span style={styles.personLabelName}>{person.name}</span>
                          </div>
                          {person.entries.map(({ booking: b, number, returnBooking }) => {
                            const isOpen = expandedId === b.id;
                            const timeStr = b.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                            return (
                              <div key={b.id} style={styles.bookingCard}>
                                <div style={styles.bookingRow}>
                                  <button style={styles.bookingHeader} onClick={() => setExpandedId(isOpen ? null : b.id)}>
                                    <div style={styles.bookingHeaderLeft}>
                                      <span style={styles.bookingTime}>{timeStr} Uhr</span>
                                      <span style={styles.bookingNumber}>#{number}</span>
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
                                  {(returnBooking || submittedReturns.current.has(b.id))
                                    ? <span style={styles.returnedBadge}><Undo2 size={18} color="#16a34a" /> zurück</span>
                                    : (
                                      <button style={styles.returnBtnInline} onClick={() => openReturn(b)}>
                                        <Undo2 size={18} color="#fff" />
                                      </button>
                                    )
                                  }
                                </div>
                                {isOpen && (
                                  <div style={styles.bookingItems}>
                                    {b.items.map((item, idx) => (
                                      <div
                                        key={item.productId}
                                        style={{ ...styles.bookingItemRow, borderBottom: idx < b.items.length - 1 ? "1px solid var(--c-border-2)" : "none" }}
                                      >
                                        <div style={styles.bookingItemLeft}>
                                          <span style={styles.bookingItemName}>{item.productName}</span>
                                          <span style={styles.bookingItemLocation}>
                                            <MapPin size={11} color="#FF7648" style={{ flexShrink: 0 }} />
                                            {formatLocation(item.parentName, item.boxName)}
                                          </span>
                                        </div>
                                        <span style={styles.bookingItemQty}>{item.quantity} {item.unit}</span>
                                      </div>
                                    ))}
                                    {returnBooking && (
                                      <div style={styles.returnSection}>
                                        <div style={styles.returnSectionHeader}>
                                          <Undo2 size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Zurückgebucht um {returnBooking.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                                        </div>
                                        {returnBooking.items.map((item) => (
                                          <div key={item.productId} style={styles.returnSectionRow}>
                                            <span style={styles.returnSectionName}>{item.productName}</span>
                                            <span style={styles.returnSectionQty}>+{item.quantity} {item.unit}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          );
          })()}
        </div>
      )}

      </div>{/* end tab content wrapper */}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16 },
  backText: { color: "#FF7648", fontSize: 14, fontWeight: 600 },
  groupHeader: { marginBottom: 16 },
  groupTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 16 },
  groupDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  groupName: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: 0, marginRight: 4 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 4 },
  actionBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "var(--c-surface)", border: "1.5px solid var(--c-border)", borderRadius: 10, padding: "8px 2px", fontSize: 11, fontWeight: 600, color: "var(--c-text-1)", cursor: "pointer", whiteSpace: "nowrap" as const, overflow: "hidden" as const },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "#0f172a", border: "none", borderRadius: 10, padding: "8px 2px", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" as const, overflow: "hidden" as const },
  tabRow: { display: "flex", gap: 6, marginBottom: 16, background: "var(--c-surface-2)", borderRadius: 12, padding: 4 },
  tab: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", borderRadius: 9, padding: "9px 4px", fontSize: 14, fontWeight: 600, color: "var(--c-text-3)", cursor: "pointer" },
  tabActive: {},
  createCard: { background: "var(--c-surface)", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "var(--neu-raised)" },
  createInput: { width: "100%", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--c-bg)", color: "var(--c-text-1)", boxShadow: "var(--neu-inset-sm)" },
  createActions: { display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "var(--c-bg)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", boxShadow: "var(--neu-raised-sm)" },
  saveBtn: { background: "#FF7648", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  emptyState: { textAlign: "center", padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)" },
  emptyBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-accent-bg)", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#FF7648", cursor: "pointer" },
  boxGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  boxCard: { background: "var(--c-surface)", borderRadius: 14, overflow: "hidden" },
  boxClickable: { display: "block", width: "100%", padding: "12px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  boxTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  boxName: { fontSize: 13, fontWeight: 700, color: "var(--c-text-1)", marginBottom: 2 },
  boxSub: { fontSize: 11, color: "var(--c-text-3)" },
  boxActions: { display: "flex", justifyContent: "flex-end", gap: 2, padding: "0 4px 6px" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", alignItems: "center", minWidth: 36, minHeight: 36, justifyContent: "center" },
  editCard: { background: "var(--c-surface)", borderRadius: 14, padding: 12, boxShadow: "var(--neu-raised-sm)" },
  editInput: { width: "100%", border: "1px solid #FF7648", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)", boxSizing: "border-box" },
  editActions: { display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" },
  colorLabel: { fontSize: 10, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 10, marginBottom: 6 },
  colorRow: { display: "flex", gap: 7, flexWrap: "wrap" },
  colorSwatch: { width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, transition: "box-shadow 0.15s" },
  deleteCard: { background: "var(--c-surface)", borderRadius: 14, padding: 12, boxShadow: "var(--neu-raised-sm)", display: "flex", flexDirection: "column", gap: 8 },
  deleteText: { fontSize: 12, color: "var(--c-text-1)", fontWeight: 500 },
  confirmDeleteBtn: { background: "#ef4444", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff" },
  memberList: { display: "flex", flexDirection: "column", gap: 10 },
  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historySearch: { border: "1.5px solid var(--c-border)", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--c-surface)", color: "var(--c-text-1)", width: "100%", boxSizing: "border-box" as const },
  unboxedCard: { width: "100%", display: "flex", alignItems: "center", gap: 14, background: "var(--c-surface)", borderRadius: 16, padding: "16px", border: "none", cursor: "pointer", textAlign: "left", boxShadow: "var(--neu-raised-sm)", marginTop: 10 },
  unboxedIcon: { width: 44, height: 44, borderRadius: 12, background: "var(--c-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  unboxedInfo: { flex: 1 },
  unboxedTitle: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" },
  unboxedSub: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  qrModal: { background: "var(--c-surface)", borderRadius: 20, padding: "16px", width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 4px 24px rgba(163,177,198,0.5)" },
  qrModalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  qrModalTitle: { fontSize: 15, fontWeight: 800, color: "var(--c-text-1)" },
  qrClose: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 },
  qrModalSub: { fontSize: 12, color: "var(--c-text-3)", lineHeight: 1.4, margin: 0 },
  qrBox: { display: "flex", justifyContent: "center", background: "var(--c-bg)", borderRadius: 14, padding: 10, boxShadow: "var(--neu-inset-sm)" },
  qrLinkRow: { background: "var(--c-bg)", borderRadius: 10, padding: "6px 10px", boxShadow: "var(--neu-inset-sm)" },
  qrLinkText: { fontSize: 10, color: "var(--c-text-3)", wordBreak: "break-all" as const, display: "block" },
  qrActions: { display: "flex", gap: 8 },
  qrCopyBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(135deg, #FF7648, #e5623a)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  qrOpenBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--c-bg)", color: "var(--c-text-1)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "var(--neu-raised-sm)" },
  dateGroup:         { background: "var(--c-surface)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--neu-raised-sm)", marginBottom: 8 },
  dateHeader:        { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  dateLabelText:     { fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" },
  dateRight:         { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  dateCount:         { fontSize: 11, fontWeight: 600, color: "var(--c-text-3)" },
  dateEntries:       { borderTop: "1px solid var(--c-border-2)", padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 10 },
  personGroup:       { display: "flex", flexDirection: "column", gap: 4 },
  personLabel:       { display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" },
  personLabelAvatar: { width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #FF7648, #e5623a)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 },
  personLabelName:   { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)" },
  bookingCard:       { background: "var(--c-surface-2)", borderRadius: 10 },
  returnedBadge:      { fontSize: 13, fontWeight: 600, color: "#16a34a", background: "#dcfce7", borderRadius: 11, padding: "0 10px", height: 44, flexShrink: 0, margin: "0 8px", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 6 },
  returnSection:      { marginTop: 8, borderTop: "1px solid #86efac", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 },
  returnSectionHeader:{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 2 },
  returnSectionRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" },
  returnSectionName:  { fontSize: 12, color: "#15803d" },
  returnSectionQty:   { fontSize: 12, fontWeight: 700, color: "#16a34a" },
  bookingRow:        { display: "flex", alignItems: "center" },
  bookingHeader:     { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  bookingHeaderLeft: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  bookingTime:       { fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" },
  bookingNumber:     { fontSize: 11, color: "var(--c-text-3)", fontWeight: 500 },
  bookingRight:      { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  bookingCount:      { fontSize: 11, fontWeight: 600, color: "#FF7648", background: "var(--c-accent-bg)", borderRadius: 6, padding: "2px 7px" },
  bookingItems:      { borderTop: "1px solid var(--c-border-2)", padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 0 },
  bookingItemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0" },
  bookingItemLeft: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  bookingItemName: { fontSize: 13, color: "var(--c-text-1)", fontWeight: 500 },
  bookingItemLocation: { display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#FF7648", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  bookingItemQty: { fontSize: 13, fontWeight: 700, color: "#FF7648", flexShrink: 0 },
  memberItem: { display: "flex", alignItems: "center", gap: 12, background: "var(--c-surface)", borderRadius: 14, padding: 14 },
  memberAvatar: { width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #FF7648, #e5623a)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 },
  memberName: { fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", display: "flex", alignItems: "center", gap: 6 },
  memberEmail: { fontSize: 12, color: "var(--c-text-3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  youBadge: { fontSize: 10, fontWeight: 700, color: "#FF7648", background: "var(--c-accent-bg)", borderRadius: 6, padding: "1px 6px" },
  roleBadge: { flexShrink: 0, background: "var(--c-surface-2)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--c-text-2)" },
  memberActions: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },
  roleSelect: { border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", background: "var(--c-surface-2)", cursor: "pointer", outline: "none", minHeight: 40 },
  removeBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", borderRadius: 8 },
  removeConfirm: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },
  removeQuestion: { fontSize: 12, fontWeight: 600, color: "#ef4444" },
  confirmRemoveBtn: { background: "#ef4444", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" },
  cancelSmallBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", cursor: "pointer" },
  inviteModal: { background: "var(--c-surface)", borderRadius: 20, padding: "16px", width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 4px 24px rgba(163,177,198,0.5)" },
  inviteTabRow: { display: "flex", gap: 8, background: "var(--c-bg)", borderRadius: 12, padding: 4 },
  inviteTabBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", cursor: "pointer", transition: "all 0.18s" },
  inviteTabActive: { background: "var(--c-surface)", color: "#FF7648", boxShadow: "var(--neu-raised-sm)" },
  inviteHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  inviteHeaderLeft: { display: "flex", alignItems: "center", gap: 8 },
  inviteHeaderIcon: { width: 28, height: 28, background: "var(--c-accent-bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--neu-raised-sm)" },
  inviteTitle: { fontSize: 15, fontWeight: 800, color: "var(--c-text-1)" },
  inviteLabel: { fontSize: 12, fontWeight: 600, color: "var(--c-text-2)" },
  inviteInputRow: { display: "flex", alignItems: "center", borderRadius: 12, overflow: "hidden", background: "var(--c-bg)", boxShadow: "var(--neu-inset-sm)" },
  inviteInput: { flex: 1, border: "none", outline: "none", padding: "10px 12px", fontSize: 14, color: "var(--c-text-1)", background: "transparent" },
  inviteAddBtn: { padding: "0 12px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", height: "100%" },
  chipRow: { display: "flex", flexWrap: "wrap" as const, gap: 6 },
  chip: { display: "flex", alignItems: "center", gap: 4, background: "var(--c-accent-bg)", borderRadius: 20, padding: "4px 10px 4px 12px" },
  chipText: { fontSize: 12, color: "#c2410c", fontWeight: 500 },
  chipRemove: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 1 },
  inviteError: { background: "#fef2f2", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#dc2626" },
  inviteActions: { display: "flex", gap: 8, marginTop: 2 },
  inviteCancelBtn: { flex: 1, background: "var(--c-bg)", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "var(--c-text-1)", cursor: "pointer", boxShadow: "var(--neu-raised-sm)" },
  inviteConfirmBtn: { flex: 1, background: "linear-gradient(135deg, #FF7648, #e5623a)", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" },
  returnBtnInline: { background: "#FF7648", border: "none", borderRadius: 11, cursor: "pointer", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 8px" },
  returnModal: { background: "var(--c-surface)", borderRadius: 20, padding: "16px", width: "100%", maxWidth: 430, maxHeight: "calc(100dvh - 120px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 -4px 24px rgba(163,177,198,0.45)" },
  returnModalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  returnModalTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  returnModalTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  returnModalSub: { fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: 0 },
  returnItemsList: { display: "flex", flexDirection: "column", gap: 10 },
  returnItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f8fafc", borderRadius: 12, padding: "10px 14px" },
  returnItemInfo: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  returnItemName: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  returnItemMax: { fontSize: 11, color: "#94a3b8" },
  returnQtyRow: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  returnQtyBtn: { width: 44, height: 44, borderRadius: 8, background: "#e2e8f0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  returnQtyVal: { fontSize: 16, fontWeight: 700, color: "#0f172a", minWidth: 24, textAlign: "center" },
  returnQtyUnit: { fontSize: 12, color: "#64748b", minWidth: 28 },
  returnError: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#dc2626" },
  returnActions: { display: "flex", gap: 10 },
  returnCancelBtn: { flex: 1, background: "#f1f5f9", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer" },
  returnConfirmBtn: { flex: 1, background: "linear-gradient(135deg, #FF7648, #e5623a)", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" },
};
