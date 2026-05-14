import React, { CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";
import type { NavigateFn, PageParams } from "../App";
import type { Space } from "../types";
import UnboxedItems from "../components/UnboxedItems";

interface UnboxedDetailProps {
  navigate: NavigateFn;
  params: PageParams;
}

export default function UnboxedDetail({ navigate, params }: UnboxedDetailProps): React.ReactElement {
  const space = params.space as Space;
  const from  = params.from as string ?? "PlaceDetail";
  const fromParam = params.fromParam as PageParams ?? { place: space };

  return (
    <div style={styles.container}>
      <button style={styles.back} onClick={() => navigate(from as never, fromParam)}>
        <ChevronLeft size={16} color="#f97316" />
        <span style={styles.backText}>Zurück zu {space?.name ?? "Place"}</span>
      </button>
      <h1 style={styles.title}>Unboxed Items</h1>
      <p style={styles.sub}>Gegenstände ohne Box in „{space?.name}"</p>
      <UnboxedItems space={space} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: "16px" },
  back: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: 16 },
  backText: { color: "#f97316", fontSize: 14, fontWeight: 600 },
  title: { fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", margin: "0 0 4px" },
  sub: { fontSize: 13, color: "var(--c-text-3)", marginBottom: 20 },
};
