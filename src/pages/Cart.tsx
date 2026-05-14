import React, { useState, CSSProperties } from "react";
import { ShoppingCart, Trash2, Minus, Plus, PackageCheck } from "lucide-react";
import type { NavigateFn } from "../App";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { createBooking } from "../services/bookings.service";
import { showBookingNotification } from "../services/notifications.service";

interface CartProps {
  navigate: NavigateFn;
}

export default function Cart({ navigate }: CartProps): React.ReactElement {
  const { user } = useAuth();
  const { items, removeFromCart, updateCartQuantity, clearCart } = useCart();
  const [booking, setBooking] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.cartQuantity, 0);

  const handleAbbuchen = async () => {
    if (!user || items.length === 0 || booking) return;
    setBooking(true);
    setError(null);
    try {
      const snapshot = [...items];
      await createBooking(
        user.uid,
        user.displayName ?? user.email ?? "Unbekannt",
        user.email ?? "",
        snapshot
      );
      const totalQty = snapshot.reduce((s, i) => s + i.cartQuantity, 0);
      showBookingNotification(snapshot.length, totalQty);
      clearCart();
      navigate("Dashboard");
    } catch (e) {
      setError("Abbuchung fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBooking(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Warenkorb</h1>
      <p style={styles.subtitle}>
        {items.length} Position{items.length !== 1 ? "en" : ""} · {totalItems} Stück gesamt
      </p>

      {items.length === 0 ? (
        <div style={styles.empty}>
          <ShoppingCart size={48} color="var(--c-border)" />
          <p style={styles.emptyText}>Dein Warenkorb ist leer</p>
          <p style={styles.emptyHint}>Drücke das 🛒-Symbol bei einem Gegenstand in einer Box</p>
        </div>
      ) : (
        <>
          <div style={styles.list}>
            {items.map((item, i) => (
              <div key={item.productId} style={{ ...styles.item, borderBottom: i < items.length - 1 ? "1px solid var(--c-border-2)" : "none" }}>
                <div style={styles.itemImg}>
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.productName} style={styles.itemImgEl} />
                    : <span style={{ fontSize: 22 }}>📦</span>}
                </div>
                <div style={styles.itemContent}>
                  <div style={styles.itemName}>{item.productName}</div>
                  <div style={styles.itemMeta}>{item.boxName} · {item.parentName}</div>
                  <div style={styles.qtyRow}>
                    <button style={styles.qtyBtn} onClick={() => updateCartQuantity(item.productId, -1)}><Minus size={12} /></button>
                    <span style={styles.qtyLabel}>{item.cartQuantity} {item.unit}</span>
                    <button style={styles.qtyBtn} onClick={() => updateCartQuantity(item.productId, 1)} disabled={item.cartQuantity >= item.maxQuantity}><Plus size={12} /></button>
                  </div>
                </div>
                <button style={styles.removeBtn} onClick={() => removeFromCart(item.productId)}>
                  <Trash2 size={15} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
          <button
            style={{ ...styles.abbuchenBtn, opacity: booking ? 0.7 : 1 }}
            onClick={handleAbbuchen}
            disabled={booking}
          >
            <PackageCheck size={18} color="#fff" />
            {booking ? "Wird abgebucht…" : "Abbuchen"}
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "20px 16px" },
  title:    { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--c-text-3)", marginTop: 4, marginBottom: 20 },
  empty: { textAlign: "center", padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  emptyText: { fontSize: 15, fontWeight: 600, color: "var(--c-text-2)" },
  emptyHint: { fontSize: 13, color: "var(--c-text-3)", maxWidth: 240 },
  list: { background: "var(--c-surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 16 },
  item: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" },
  itemImg: { width: 48, height: 48, borderRadius: 10, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  itemImgEl: { width: "100%", height: "100%", objectFit: "cover" },
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 600, color: "var(--c-text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemMeta: { fontSize: 12, color: "var(--c-text-3)", marginTop: 2 },
  qtyRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  qtyBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 5, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  qtyLabel: { fontSize: 13, fontWeight: 600, color: "var(--c-text-1)", minWidth: 40, textAlign: "center" },
  removeBtn: { background: "var(--c-surface-2)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 },
  errorBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 10 },
  abbuchenBtn: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff", border: "none", borderRadius: 14,
    padding: "15px", fontSize: 16, fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
  },
};
