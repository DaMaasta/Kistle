import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

interface BottomSheetProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function BottomSheet({ onClose, children, maxWidth = 480 }: BottomSheetProps): React.ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  return createPortal(
    <div
      style={{ ...styles.overlay, opacity: visible ? 1 : 0, transition: "opacity 0.28s" }}
      onClick={handleClose}
    >
      <div
        style={{
          ...styles.sheet,
          maxWidth,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.handle} />
        {children}
      </div>
    </div>,
    document.body
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 1000,
  },
  sheet: {
    background: "var(--c-surface)",
    borderRadius: "24px 24px 0 0",
    padding: "12px 20px calc(env(safe-area-inset-bottom) + 24px)",
    width: "100%",
    display: "flex", flexDirection: "column", gap: 16,
    maxHeight: "90dvh", overflowY: "auto",
  },
  handle: { width: 40, height: 4, borderRadius: 2, background: "var(--c-border)", margin: "0 auto 4px" },
};
