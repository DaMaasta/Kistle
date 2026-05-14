import React, { useState, useEffect, useRef, CSSProperties } from "react";
import { ChevronLeft, Plus, Minus, Trash2, Camera, X, Pencil, Check, ShoppingCart } from "lucide-react";
import type { NavigateFn, PageParams } from "../App";
import type { Space, Product, ProductUnit } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { compressImageToBase64 } from "../utils/imageUtils";
import QuantityModal from "../components/QuantityModal";
import {
  subscribeToSpaceProducts,
  createProduct,
  updateProduct,
  updateQuantity,
  deleteProduct,
} from "../services/products.service";

interface BoxDetailProps {
  navigate: NavigateFn;
  params: PageParams;
}

const UNITS: ProductUnit[] = ["Stück", "kg", "g", "L", "ml", "Packung", "Flasche", "Dose", "Paar", "Box"];
const emptyForm = { name: "", description: "", quantity: 1, unit: "Stück" as ProductUnit };

export default function BoxDetail({ navigate, params }: BoxDetailProps): React.ReactElement {
  const box   = params.box   as Space;
  const place = params.place as Space;
  const { user } = useAuth();
  const { addToCart, items: cartItems } = useCart();

  const [products, setProducts]       = useState<Product[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [form, setForm]               = useState(emptyForm);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [preview, setPreview]         = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!box?.id) return;
    return subscribeToSpaceProducts(box.id, setProducts);
  }, [box?.id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (preview && !existingImageUrl) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setExistingImageUrl(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setShowForm(false);
    setEditProductId(null);
  };

  const startEdit = (p: Product) => {
    setEditProductId(p.id);
    setForm({ name: p.name, description: p.description, quantity: p.quantity, unit: p.unit });
    setExistingImageUrl(p.imageUrl);
    setPreview(p.imageUrl);
    setImageFile(null);
    setShowForm(true);
    setDeleteId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user || saving) return;
    setSaving(true);
    try {
      let imageUrl: string | null = existingImageUrl;

      if (imageFile) {
        imageUrl = await compressImageToBase64(imageFile);
      }

      if (editProductId) {
        await updateProduct(editProductId, user.uid, user.email ?? "", {
          name: form.name.trim(), description: form.description.trim(),
          quantity: form.quantity, unit: form.unit, imageUrl,
        });
      } else {
        await createProduct(box.id, user.uid, user.email ?? "", {
          name: form.name.trim(), description: form.description.trim(),
          quantity: form.quantity, unit: form.unit,
          minQuantity: null, category: "", barcode: null, imageUrl,
        });
      }
      resetForm();
    } finally { setSaving(false); }
  };

  const handleQuantity = (p: Product, delta: number) => {
    if (!user) return;
    updateQuantity(p.id, user.uid, user.email ?? "", Math.max(0, p.quantity + delta));
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    setDeleteId(null);
  };

  return (
    <div style={styles.container}>
      <button style={styles.back} onClick={() =>
        place?.isGroup
          ? navigate("GroupDetail", { group: place })
          : navigate("PlaceDetail", { place })
      }>
        <ChevronLeft size={16} color="#f97316" />
        <span style={styles.backText}>Zurück zu {place?.name ?? "Place"}</span>
      </button>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📦 {box?.name ?? "Box"}</h1>
          <p style={styles.subtitle}>{products.length} Gegenstand{products.length !== 1 ? "e" : ""}</p>
        </div>
        <button style={styles.newBtn} onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} color="#fff" /> Hinzufügen
        </button>
      </div>

      {/* Formular (Neu oder Bearbeiten) */}
      {showForm && (
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <span style={styles.formTitle}>{editProductId ? "Gegenstand bearbeiten" : "Neuer Gegenstand"}</span>
            <button style={styles.closeBtn} onClick={resetForm}><X size={18} color="var(--c-text-3)" /></button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
          <button style={styles.imagePicker} onClick={() => fileInputRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="Vorschau" style={styles.imagePreview} />
            ) : (
              <><Camera size={22} color="var(--c-text-3)" /><span style={styles.imagePickerText}>Foto hinzufügen</span></>
            )}
          </button>

          <div style={styles.field}>
            <label style={styles.label}>Name *</label>
            <input style={styles.input} placeholder="z.B. Schraubenzieher" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus={!editProductId} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Beschreibung</label>
            <input style={styles.input} placeholder="Optional" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Anzahl</label>
              <div style={styles.qtyRow}>
                <button style={styles.qtyBtn} onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}><Minus size={14} /></button>
                <span style={styles.qtyVal}>{form.quantity}</span>
                <button style={styles.qtyBtn} onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}><Plus size={14} /></button>
              </div>
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Einheit</label>
              <select style={styles.select} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as ProductUnit })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <button style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Wird gespeichert…" : editProductId ? "Änderungen speichern" : "Speichern"}
          </button>

          {editProductId && (
            deleteId === editProductId ? (
              <div style={styles.deleteConfirm}>
                <span style={styles.deleteConfirmText}>Gegenstand wirklich löschen?</span>
                <div style={styles.deleteConfirmBtns}>
                  <button style={styles.confirmDeleteBtn} onClick={() => { handleDelete(editProductId); resetForm(); }}>Löschen</button>
                  <button style={styles.cancelSmBtn} onClick={() => setDeleteId(null)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <button style={styles.deleteBtn} onClick={() => setDeleteId(editProductId)}>
                <Trash2 size={15} color="#ef4444" /> Gegenstand löschen
              </button>
            )
          )}
        </div>
      )}

      {/* Produktliste */}
      {products.length === 0 && !showForm ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: 48 }}>📦</span>
          <p style={styles.emptyText}>Die Box ist leer</p>
          <button style={styles.emptyBtn} onClick={() => setShowForm(true)}>
            <Plus size={14} color="#f97316" /> Ersten Gegenstand hinzufügen
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {products.map((p) => {
            const inCart   = cartItems.some(ci => ci.productId === p.id);
            const isHovered = hoveredId === p.id;
            return (
              <div
                key={p.id}
                style={styles.card}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {deleteId === p.id ? (
                  <div style={styles.deleteRow}>
                    <span style={styles.deleteText}>„{p.name}" löschen?</span>
                    <button style={styles.confirmDeleteBtn} onClick={() => handleDelete(p.id)}>Löschen</button>
                    <button style={styles.cancelSmBtn} onClick={() => setDeleteId(null)}>Nein</button>
                  </div>
                ) : (
                  <div style={styles.item}>
                    <div style={styles.itemImg}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} style={styles.itemImgEl} />
                        : <span style={styles.itemInitial}>{p.name[0]?.toUpperCase() ?? "?"}</span>
                      }
                    </div>
                    <div style={styles.itemInfo}>
                      <div style={styles.itemNameRow}>
                        <span style={styles.itemName}>{p.name}</span>
                        <button
                          style={{ ...styles.pencilBtn, opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? "auto" : "none" }}
                          onClick={() => startEdit(p)}
                        >
                          <Pencil size={14} color="var(--c-text-3)" />
                        </button>
                      </div>
                      <div style={styles.itemAvail}>
                        <span style={styles.itemQtyNum}>{p.quantity}</span>
                      </div>
                    </div>
                    <button
                      style={{ ...styles.cartBtn, opacity: p.quantity === 0 ? 0.35 : 1, background: inCart ? "#c2410c" : "#f97316" }}
                      onClick={() => setModalProduct(p)}
                      disabled={p.quantity === 0}
                      title="Zum Warenkorb hinzufügen"
                    >
                      <ShoppingCart size={18} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalProduct && (
        <QuantityModal
          product={modalProduct}
          initialQty={cartItems.find(ci => ci.productId === modalProduct.id)?.cartQuantity ?? 1}
          onConfirm={(qty) => {
            addToCart({
              productId: modalProduct.id,
              productName: modalProduct.name,
              imageUrl: modalProduct.imageUrl,
              maxQuantity: modalProduct.quantity,
              unit: modalProduct.unit,
              boxId: box.id,
              boxName: box.name,
              parentId: place?.id ?? null,
              parentName: place?.name ?? "",
            }, qty);
            setModalProduct(null);
          }}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: 16 },
  backText: { color: "#f97316", fontSize: 14, fontWeight: 600 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4 },
  newBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-dark-btn)", color: "var(--c-dark-btn-text)", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  formCard: { background: "var(--c-surface)", borderRadius: 20, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 14 },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  formTitle: { fontSize: 16, fontWeight: 700, color: "var(--c-text-1)" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  imagePicker: { width: "100%", height: 120, borderRadius: 14, border: "2px dashed var(--c-border)", background: "var(--c-surface-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", overflow: "hidden", padding: 0 },
  imagePreview: { width: "100%", height: "100%", objectFit: "cover" },
  imagePickerText: { fontSize: 13, color: "var(--c-text-3)", fontWeight: 500 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: "var(--c-text-1)", background: "var(--c-bg)" },
  row: { display: "flex", gap: 12 },
  qtyRow: { display: "flex", alignItems: "center", gap: 10, background: "var(--c-surface-2)", borderRadius: 10, padding: "8px 12px" },
  qtyBtn: { background: "var(--c-border)", border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  qtyVal: { fontSize: 16, fontWeight: 700, color: "var(--c-text-1)", minWidth: 24, textAlign: "center" },
  select: { border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", background: "var(--c-bg)", color: "var(--c-text-1)" },
  saveBtn: { background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  emptyState: { textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "var(--c-text-3)" },
  emptyBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-accent-bg)", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#f97316", cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "var(--c-surface)", borderRadius: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" },
  item: { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" },
  itemImg: { width: 52, height: 52, borderRadius: 14, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  itemImgEl: { width: "100%", height: "100%", objectFit: "cover" },
  itemInitial: { fontSize: 22, fontWeight: 700, color: "var(--c-text-3)" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemNameRow: { display: "flex", alignItems: "center", gap: 8 },
  itemName: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  pencilBtn: { background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", flexShrink: 0, transition: "opacity 0.15s" },
  itemAvail: { display: "flex", alignItems: "baseline", marginTop: 3 },
  itemQtyNum: { fontSize: 20, fontWeight: 800, color: "var(--c-text-1)" },
  itemQtyLabel: { fontSize: 13, color: "#22c55e", fontWeight: 500 },
  cartBtn: { border: "none", borderRadius: 14, width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" },
  deleteRow: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", flexWrap: "wrap" },
  deleteText: { flex: 1, fontSize: 13, color: "var(--c-text-1)", fontWeight: 500 },
  confirmDeleteBtn: { background: "#ef4444", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" },
  cancelSmBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" },
  deleteBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, color: "#ef4444", cursor: "pointer", width: "100%" },
  deleteConfirm: { background: "#fef2f2", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 },
  deleteConfirmText: { fontSize: 13, fontWeight: 600, color: "#991b1b" },
  deleteConfirmBtns: { display: "flex", gap: 8 },
};
