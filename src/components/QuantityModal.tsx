import React, { useState, CSSProperties } from "react";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { Product } from "../types";

interface QuantityModalProps {
  product: Product;
  initialQty: number;
  onConfirm: (qty: number) => void;
  onClose: () => void;
}

export default function QuantityModal({ product, initialQty, onConfirm, onClose }: QuantityModalProps): React.ReactElement {
  const [qty, setQty] = useState(initialQty);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />

        <div style={styles.header}>
          <div style={styles.productImg}>
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} style={styles.productImgEl} />
              : <span style={styles.productInitial}>{product.name[0]?.toUpperCase()}</span>
            }
          </div>
          <div style={styles.headerInfo}>
            <div style={styles.productName}>{product.name}</div>
            <div style={styles.productMax}>max. {product.quantity} {product.unit} verfügbar</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} color="var(--c-text-3)" /></button>
        </div>

        <div style={styles.qtyRow}>
          <button
            style={{ ...styles.qtyBtn, opacity: qty <= 1 ? 0.35 : 1 }}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
          >
            <Minus size={20} />
          </button>
          <span style={styles.qtyVal}>{qty}</span>
          <button
            style={{ ...styles.qtyBtn, opacity: qty >= product.quantity ? 0.35 : 1 }}
            onClick={() => setQty((q) => Math.min(product.quantity, q + 1))}
            disabled={qty >= product.quantity}
          >
            <Plus size={20} />
          </button>
        </div>

        <button style={styles.confirmBtn} onClick={() => onConfirm(qty)}>
          <ShoppingCart size={18} color="#fff" />
          In den Warenkorb
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 1000,
  },
  sheet: {
    background: "var(--c-surface)", borderRadius: "24px 24px 0 0",
    padding: "12px 24px 40px", width: "100%", maxWidth: 430,
    display: "flex", flexDirection: "column", gap: 24,
    boxShadow: "0 -4px 30px rgba(0,0,0,0.15)",
  },
  handle: { width: 40, height: 4, borderRadius: 2, background: "var(--c-border)", margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 14 },
  productImg: { width: 52, height: 52, borderRadius: 14, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  productImgEl: { width: "100%", height: "100%", objectFit: "cover" },
  productInitial: { fontSize: 22, fontWeight: 700, color: "var(--c-text-3)" },
  headerInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: 700, color: "var(--c-text-1)" },
  productMax: { fontSize: 13, color: "var(--c-text-3)", marginTop: 2 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  qtyRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 32 },
  qtyBtn: {
    width: 52, height: 52, borderRadius: 16,
    background: "var(--c-surface-2)", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--c-text-1)", transition: "opacity 0.15s",
  },
  qtyVal: { fontSize: 42, fontWeight: 800, color: "var(--c-text-1)", minWidth: 64, textAlign: "center" },
  confirmBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff", border: "none", borderRadius: 16,
    padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
  },
};
