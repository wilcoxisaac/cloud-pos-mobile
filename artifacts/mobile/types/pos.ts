export type SelectedModifier = {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceAdjustment: number;
};

export type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  industry: string;
  sku?: string | null;
  emoji?: string | null;
  modifiers?: string | null;
  pricingType: "fixed" | "hourly" | "weight";
  unit?: string | null;
  isBundle: boolean;
  bundleItems?: { name: string; quantity: number }[] | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  unitQuantity?: number | null;
  notes?: string | null;
  selectedModifiers?: SelectedModifier[];
  subtotal: number;
};

export type Order = {
  id: number;
  orderNumber: string;
  status: "open" | "paid" | "voided";
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: "cash" | "card" | null;
  amountTendered?: number | null;
  changeDue?: number | null;
  tableNumber?: string | null;
  guestCount?: number | null;
  customerName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
};

export type PaymentResult = {
  order: Order;
  changeDue?: number | null;
  success: boolean;
  message: string;
};
