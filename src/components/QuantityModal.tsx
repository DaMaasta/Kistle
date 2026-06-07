import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
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
  const [qtyText, setQtyText] = useState(String(initialQty));
  const [visible, setVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 340);
  }, [onClose]);

  const handleConfirm = useCallback((q: number) => {
    setConfirmed(true);
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => onConfirm(q), 340);
    }, 600);
  }, [onConfirm]);

  return createPortal(
    <div
      style={{ ...styles.overlay, opacity: visible ? 1 : 0 }}
      onClick={handleClose}
    >
      <div
        style={{
          ...styles.sheet,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <button style={styles.closeBtn} onClick={handleClose}><X size={18} color="var(--c-text-3)" /></button>
        </div>

        <div style={styles.qtyRow}>
          <button
            style={{ ...styles.qtyBtn, opacity: qty <= 1 ? 0.35 : 1 }}
            onClick={() => { const n = Math.max(1, qty - 1); setQty(n); setQtyText(String(n)); }}
            disabled={qty <= 1}
          >
            <Minus size={20} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            style={styles.qtyVal}
            value={qtyText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setQtyText(raw);
              const n = parseInt(raw);
              if (!isNaN(n) && n >= 1 && n <= product.quantity) setQty(n);
            }}
            onBlur={() => setQtyText(String(qty))}
          />
          <button
            style={{ ...styles.qtyBtn, opacity: qty >= product.quantity ? 0.35 : 1 }}
            onClick={() => { const n = Math.min(product.quantity, qty + 1); setQty(n); setQtyText(String(n)); }}
            disabled={qty >= product.quantity}
          >
            <Plus size={20} />
          </button>
        </div>

        <button
          style={{ ...styles.confirmBtn, background: confirmed ? "#16a34a" : "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", boxShadow: confirmed ? "0 4px 14px rgba(22,163,74,0.35)" : "0 4px 14px rgba(249,115,22,0.35)", transition: "background 0.2s, box-shadow 0.2s" }}
          onClick={() => !confirmed && handleConfirm(qty)}
        >
          <ShoppingCart size={18} color="#fff" />
          In den Warenkorb
        </button>
      </div>
    </div>,
    document.body
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
    padding: "12px 24px calc(env(safe-area-inset-bottom) + 90px)", width: "100%", maxWidth: 430,
    display: "flex", flexDirection: "column", gap: 24,
    boxShadow: "0 -4px 24px rgba(163,177,198,0.45)",
  },
  handle: { width: 40, height: 4, borderRadius: 2, background: "var(--c-border)", margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 14 },
  productImg: { width: 52, height: 52, borderRadius: 14, background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", boxShadow: "var(--neu-raised-sm)" },
  productImgEl: { width: "100%", height: "100%", objectFit: "cover" },
  productInitial: { fontSize: 22, fontWeight: 700, color: "var(--c-text-3)" },
  headerInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: 700, color: "var(--c-text-1)" },
  productMax: { fontSize: 13, color: "var(--c-text-3)", marginTop: 2 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  qtyRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 32 },
  qtyBtn: {
    width: 52, height: 52, borderRadius: 16,
    background: "var(--c-bg)", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--c-text-1)", transition: "opacity 0.15s",
    boxShadow: "var(--neu-raised-sm)",
  },
  qtyVal: { fontSize: 42, fontWeight: 800, color: "var(--c-text-1)", minWidth: 64, width: 80, textAlign: "center", border: "none", outline: "none", background: "transparent", padding: 0, fontFamily: "inherit" },
  confirmBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff", border: "none", borderRadius: 16,
    padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
  },
};
