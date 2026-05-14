import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartQuantity'>, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateCartQuantity: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (incoming: Omit<CartItem, 'cartQuantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === incoming.productId);
      const clamped  = Math.min(Math.max(1, quantity), incoming.maxQuantity);
      if (existing) {
        return prev.map((i) =>
          i.productId === incoming.productId ? { ...i, cartQuantity: clamped } : i
        );
      }
      return [...prev, { ...incoming, cartQuantity: clamped }];
    });
  };

  const removeFromCart = (productId: string) =>
    setItems((prev) => prev.filter((i) => i.productId !== productId));

  const updateCartQuantity = (productId: string, delta: number) =>
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId
            ? { ...i, cartQuantity: Math.min(Math.max(0, i.cartQuantity + delta), i.maxQuantity) }
            : i
        )
        .filter((i) => i.cartQuantity > 0)
    );

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateCartQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
