import React, { useState, useEffect, CSSProperties } from "react";
import { Search, Package, ShoppingCart } from "lucide-react";
import type { NavigateFn } from "../App";
import type { Product, Space } from "../types";
import { subscribeToAllProducts } from "../services/products.service";
import { subscribeToAllSpaces } from "../services/spaces.service";
import { useCart } from "../contexts/CartContext";
import QuantityModal from "../components/QuantityModal";

interface SearchPageProps {
  navigate: NavigateFn;
}

export default function SearchPage({ navigate }: SearchPageProps): React.ReactElement {
  const { addToCart, items: cartItems } = useCart();
  const [query, setQuery]         = useState("");
  const [products, setProducts]   = useState<Product[]>([]);
  const [spaces, setSpaces]       = useState<Space[]>([]);
  const [modalProduct, setModalProduct] = useState<{ product: Product; box: Space; parent: Space | undefined } | null>(null);

  useEffect(() => subscribeToAllProducts(setProducts), []);
  useEffect(() => subscribeToAllSpaces(setSpaces), []);

  const spaceMap = new Map(spaces.map((s) => [s.id, s]));

  const q = query.trim().toLowerCase();
  const results = q.length >= 2
    ? products.filter((p) =>
        p.quantity > 0 && (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (spaceMap.get(p.spaceId)?.name ?? "").toLowerCase().includes(q)
        )
      )
    : [];

  const handleOpen = (p: Product) => {
    const box = spaceMap.get(p.spaceId);
    if (!box) return;
    const parent = box.parentId ? spaceMap.get(box.parentId) : undefined;
    navigate("BoxDetail", { box, place: parent ?? null });
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Suche</h1>

      <div style={styles.searchBox}>
        <Search size={18} color="#94a3b8" />
        <input
          style={styles.input}
          placeholder="Name oder Beschreibung..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {q.length < 2 ? (
        <div style={styles.hint}>
          <Search size={44} color="var(--c-border)" />
          <p style={styles.hintText}>Mindestens 2 Zeichen eingeben</p>
        </div>
      ) : results.length === 0 ? (
        <div style={styles.hint}>
          <Package size={44} color="var(--c-border)" />
          <p style={styles.hintText}>Keine Ergebnisse für „{query}"</p>
        </div>
      ) : (
        <div style={styles.list}>
          {results.map((p) => {
            const inCart = cartItems.some(ci => ci.productId === p.id);
            const box    = spaceMap.get(p.spaceId);
            const parent = box?.parentId ? spaceMap.get(box.parentId) : undefined;
            return (
              <div
                key={p.id}
                style={styles.card}
                onClick={() => handleOpen(p)}
              >
                <div style={styles.item}>
                  <div style={styles.itemImg}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} style={styles.itemImgEl} />
                      : <span style={styles.itemInitial}>{p.name[0]?.toUpperCase() ?? "?"}</span>
                    }
                  </div>
                  <div style={styles.itemInfo}>
                    <div style={styles.itemName}>{p.name}</div>
                    <div style={styles.itemAvail}>
                      <span style={styles.itemQtyNum}>{p.quantity}</span>
                    </div>
                  </div>
                  <button
                    style={{ ...styles.cartBtn, opacity: p.quantity === 0 ? 0.35 : 1, background: inCart ? "#c2410c" : "#f97316" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!box) return;
                      setModalProduct({ product: p, box, parent });
                    }}
                    disabled={p.quantity === 0}
                    title="Zum Warenkorb hinzufügen"
                  >
                    <ShoppingCart size={18} color="#fff" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalProduct && (
        <QuantityModal
          product={modalProduct.product}
          initialQty={cartItems.find(ci => ci.productId === modalProduct.product.id)?.cartQuantity ?? 1}
          onConfirm={(qty) => {
            const { product: p, box, parent } = modalProduct;
            addToCart({
              productId: p.id,
              productName: p.name,
              imageUrl: p.imageUrl,
              maxQuantity: p.quantity,
              unit: p.unit,
              boxId: box.id,
              boxName: box.name,
              parentId: parent?.id ?? null,
              parentName: parent?.name ?? "",
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
  container: { padding: "20px 16px" },
  title:    { fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", margin: 0, marginBottom: 16 },
  searchBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--c-surface)", border: "2px solid #f97316", borderRadius: 14,
    padding: "0 16px", marginBottom: 20,
  },
  input: { flex: 1, border: "none", outline: "none", fontSize: 14, color: "var(--c-text-1)", background: "transparent", padding: "13px 0" },
  hint: { textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  hintText: { fontSize: 14, color: "var(--c-text-3)" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "var(--c-surface)", borderRadius: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden", cursor: "pointer" },
  item: { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" },
  itemImg: { width: 52, height: 52, borderRadius: 14, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  itemImgEl: { width: "100%", height: "100%", objectFit: "cover" },
  itemInitial: { fontSize: 22, fontWeight: 700, color: "var(--c-text-3)" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 15, fontWeight: 700, color: "var(--c-text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemAvail: { display: "flex", alignItems: "baseline", marginTop: 3 },
  itemQtyNum: { fontSize: 20, fontWeight: 800, color: "var(--c-text-1)" },
  cartBtn: { border: "none", borderRadius: 14, width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" },
};
