import React, { createContext, useContext, useState, useCallback } from "react";
import type { Product, SelectedModifier } from "@/types/pos";

export type CartItem = {
  product: Product;
  quantity: number;
  unitQuantity?: number | null;
  notes?: string;
  selectedModifiers?: SelectedModifier[];
  itemKey: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (
    product: Product,
    options?: {
      quantity?: number;
      unitQuantity?: number | null;
      notes?: string;
      selectedModifiers?: SelectedModifier[];
    }
  ) => void;
  removeItem: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  subtotal: number;
  tax: number;
  itemCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.08;

function makeItemKey(productId: number, modifiers?: SelectedModifier[]) {
  const modKey = modifiers && modifiers.length > 0
    ? "-" + modifiers.map((m) => `${m.groupId}:${m.optionId}`).join(",")
    : "";
  return `${productId}${modKey}-${Date.now()}`;
}

function calcUnitPrice(product: Product, modifiers?: SelectedModifier[]) {
  const modTotal = (modifiers ?? []).reduce((sum, m) => sum + m.priceAdjustment, 0);
  return product.price + modTotal;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (
      product: Product,
      options: {
        quantity?: number;
        unitQuantity?: number | null;
        notes?: string;
        selectedModifiers?: SelectedModifier[];
      } = {}
    ) => {
      const { quantity = 1, unitQuantity, notes, selectedModifiers } = options;
      const unitPrice = calcUnitPrice(product, selectedModifiers);
      const productWithPrice = unitPrice !== product.price
        ? { ...product, price: unitPrice }
        : product;

      setItems((prev) => {
        if (!selectedModifiers || selectedModifiers.length === 0) {
          const existing = prev.find(
            (i) => i.product.id === product.id && (!i.selectedModifiers || i.selectedModifiers.length === 0)
          );
          if (existing) {
            return prev.map((i) =>
              i.itemKey === existing.itemKey
                ? { ...i, quantity: i.quantity + quantity }
                : i
            );
          }
        }
        const itemKey = makeItemKey(product.id, selectedModifiers);
        return [
          ...prev,
          {
            product: productWithPrice,
            quantity,
            unitQuantity: unitQuantity ?? null,
            notes,
            selectedModifiers,
            itemKey,
          },
        ];
      });
    },
    []
  );

  const removeItem = useCallback((itemKey: string) => {
    setItems((prev) => prev.filter((i) => i.itemKey !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.itemKey !== itemKey));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.itemKey === itemKey ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, i) => {
    const effectiveQty = i.unitQuantity != null ? i.unitQuantity : i.quantity;
    return sum + i.product.price * effectiveQty;
  }, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, total, subtotal, tax, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
