import type { Order, Product, PaymentResult, SelectedModifier } from "@/types/pos";
import type { IndustryMode } from "@/context/SettingsContext";

export type ModifierOption = {
  id: number;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  sortOrder: number;
};

export type ModifierGroup = {
  id: number;
  name: string;
  description?: string | null;
  industryContext: string;
  selectionType: "single" | "multiple";
  minSelections: number;
  maxSelections?: number | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options: ModifierOption[];
  createdAt: string;
  updatedAt: string;
};

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      errorMessage = body.message ?? errorMessage;
    } catch {
      try {
        errorMessage = (await res.text()) || errorMessage;
      } catch {}
    }
    throw new Error(errorMessage);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export type PosAlert = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  createdAt: string;
};

export type AppSettings = {
  industry: IndustryMode;
  taxRate: string;
  defaultPaymentTerms: string;
  invoicePaymentMethods: string[];
};

export type RestaurantTable = {
  id: number;
  name: string;
  capacity: number;
  section: string;
  status: "available" | "occupied" | "reserved" | "cleaning";
  currentOrderId: number | null;
  currentOrder: {
    id: number;
    tableNumber: string | null;
    total: string;
    createdAt: string;
    customerName: string | null;
    guestCount: number | null;
  } | null;
  updatedAt: string;
};

export type Appointment = {
  id: number;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  staffName: string | null;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "no-show";
  notes: string | null;
  orderId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Reservation = {
  id: number;
  partyName: string;
  partySize: number;
  phone: string | null;
  reservationDate: string;
  reservationTime: string;
  tablePreference: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "seated" | "no-show" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type QuoteItem = {
  id: number;
  productId: number | null;
  productName: string;
  productPrice: number;
  quantity: number;
  notes: string | null;
  included: boolean;
  subtotal: number;
};

export type QuoteDoc = {
  id: number;
  quoteNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  industry: string;
  status: "draft" | "sent" | "accepted" | "declined";
  validUntilDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  token: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  portalUrl?: string;
  emailSent?: boolean;
};

export type InvoiceItem = {
  id: number;
  productId: number | null;
  productName: string;
  productPrice: number;
  quantity: number;
  notes: string | null;
  subtotal: number;
};

export type InvoiceDoc = {
  id: number;
  invoiceNumber: string;
  quoteId: number | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  industry: string;
  status: "unpaid" | "paid" | "overdue" | "voided";
  dueDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  token: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  portalUrl?: string;
  emailSent?: boolean;
};

export type KitchenTicket = {
  id: number;
  orderNumber: string;
  tableNumber: string | null;
  guestCount: number | null;
  customerName: string | null;
  kitchenStatus: "new" | "preparing" | "ready" | "served";
  total: number;
  createdAt: string;
  updatedAt: string;
  items: { id: number; productName: string; quantity: number; notes: string | null }[];
};

export const api = {
  products: {
    list: (industry?: string) =>
      request<Product[]>(`/products${industry ? `?industry=${encodeURIComponent(industry)}` : ""}`),
    create: (data: Partial<Product>) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Product>) =>
      request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/products/${id}`, { method: "DELETE" }),
  },
  orders: {
    list: (status?: "open" | "paid" | "voided") =>
      request<Order[]>(`/orders${status ? `?status=${status}` : ""}`),
    get: (id: number) => request<Order>(`/orders/${id}`),
    create: (data: {
      tableNumber?: string | null;
      guestCount?: number | null;
      customerName?: string | null;
      notes?: string | null;
      items: {
        productId: number;
        quantity: number;
        unitQuantity?: number | null;
        notes?: string | null;
        selectedModifiers?: SelectedModifier[];
      }[];
    }) => request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
    update: (
      id: number,
      data: Partial<Pick<Order, "tableNumber" | "customerName" | "notes"> & { guestCount?: number | null }>
    ) => request<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    void: (id: number) => request<Order>(`/orders/${id}/void`, { method: "POST" }),
    pay: (id: number, data: { method: "cash" | "card"; amountTendered?: number | null }) =>
      request<PaymentResult>(`/orders/${id}/pay`, { method: "POST", body: JSON.stringify(data) }),
    addItem: (
      id: number,
      data: { productId: number; quantity: number; notes?: string | null }
    ) => request<Order>(`/orders/${id}/items`, { method: "POST", body: JSON.stringify(data) }),
    removeItem: (orderId: number, itemId: number) =>
      request<Order>(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" }),
    receipt: (
      id: number,
      data: { method: "email" | "sms"; name: string; contact: string; enrollLoyalty: boolean },
    ) =>
      request<{
        sent: boolean;
        loyalty: {
          isNew: boolean;
          pointsEarned: number;
          customer: { id: number; name: string; loyaltyPoints: number; tier: string; tierColor: string };
        } | null;
      }>(`/orders/${id}/receipt`, { method: "POST", body: JSON.stringify(data) }),
  },
  tables: {
    list: () => request<RestaurantTable[]>("/tables"),
    create: (data: { name: string; capacity: number; section: string }) =>
      request<RestaurantTable>("/tables", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { status?: string; currentOrderId?: number | null; name?: string; capacity?: number; section?: string }) =>
      request<RestaurantTable>(`/tables/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    updateStatus: (id: number, data: { status?: string; currentOrderId?: number | null }) =>
      request<RestaurantTable>(`/tables/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/tables/${id}`, { method: "DELETE" }),
  },
  appointments: {
    list: (date?: string) =>
      request<Appointment[]>(`/appointments${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    create: (data: {
      clientName: string;
      clientPhone?: string;
      serviceName: string;
      staffName?: string;
      appointmentDate: string;
      appointmentTime: string;
      durationMinutes?: number;
      notes?: string;
    }) => request<Appointment>("/appointments", { method: "POST", body: JSON.stringify(data) }),
    listMonth: (month: string) =>
      request<Appointment[]>(`/appointments?month=${encodeURIComponent(month)}`),
    updateStatus: (id: number, data: { status?: string; orderId?: number | null; staffName?: string; notes?: string }) =>
      request<Appointment>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/appointments/${id}`, { method: "DELETE" }),
  },
  reservations: {
    list: (date?: string) =>
      request<Reservation[]>(`/reservations${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    listMonth: (month: string) =>
      request<Reservation[]>(`/reservations?month=${encodeURIComponent(month)}`),
    create: (data: {
      partyName: string;
      partySize?: number;
      phone?: string;
      reservationDate: string;
      reservationTime: string;
      tablePreference?: string;
      notes?: string;
    }) => request<Reservation>("/reservations", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, data: { status?: string; notes?: string; tablePreference?: string }) =>
      request<Reservation>(`/reservations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/reservations/${id}`, { method: "DELETE" }),
  },
  modifiers: {
    getForProduct: (productId: number) =>
      request<ModifierGroup[]>(`/products/${productId}/modifier-groups`),
  },
  kitchen: {
    list: () => request<KitchenTicket[]>("/kitchen"),
    updateStatus: (id: number, kitchenStatus: string) =>
      request<any>(`/orders/${id}/kitchen`, { method: "PATCH", body: JSON.stringify({ kitchenStatus }) }),
  },
  reports: {
    summary: () => request<any>("/reports/summary"),
  },
  quotes: {
    list: () => request<QuoteDoc[]>("/quotes"),
    get: (id: number) => request<QuoteDoc>(`/quotes/${id}`),
    create: (data: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      industry?: string;
      validUntilDate?: string;
      notes?: string;
      items: Array<{ productId?: number; productName: string; productPrice: number; quantity: number; notes?: string }>;
    }) => request<QuoteDoc>("/quotes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ status: string; customerName: string; customerEmail: string; customerPhone: string; notes: string; validUntilDate: string }>) =>
      request<QuoteDoc>(`/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    accept: (id: number, data: { acceptedItemIds?: number[]; dueDate?: string }) =>
      request<InvoiceDoc>(`/quotes/${id}/accept`, { method: "POST", body: JSON.stringify(data) }),
    send: (id: number) =>
      request<QuoteDoc & { portalUrl: string; emailSent: boolean }>(`/quotes/${id}/send`, { method: "POST" }),
    delete: (id: number) => request<void>(`/quotes/${id}`, { method: "DELETE" }),
  },
  invoices: {
    list: () => request<InvoiceDoc[]>("/invoices"),
    get: (id: number) => request<InvoiceDoc>(`/invoices/${id}`),
    create: (data: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      industry?: string;
      dueDate?: string;
      notes?: string;
      items: Array<{ productId?: number; productName: string; productPrice: number; quantity: number; notes?: string }>;
    }) => request<InvoiceDoc>("/invoices", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ status: string; dueDate: string; notes: string; customerName: string; customerEmail: string; customerPhone: string }>) =>
      request<InvoiceDoc>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    pay: (id: number) => request<InvoiceDoc>(`/invoices/${id}/pay`, { method: "POST" }),
    send: (id: number) =>
      request<InvoiceDoc & { portalUrl: string; emailSent: boolean }>(`/invoices/${id}/send`, { method: "POST" }),
    delete: (id: number) => request<void>(`/invoices/${id}`, { method: "DELETE" }),
  },
  alerts: {
    list: () => request<PosAlert[]>("/alerts"),
    dismiss: (id: string) =>
      request<{ dismissed: boolean; id: string }>(`/alerts/${id}/dismiss`, { method: "POST" }),
  },
  settings: {
    get: () => request<AppSettings>("/settings"),
    update: (data: Partial<AppSettings>) =>
      request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  },
  customers: {
    list: () => request<CustomerSummary[]>("/customers"),
    get: (id: number) => request<CustomerDetail>(`/customers/${id}`),
    create: (data: { name: string; email?: string; phone?: string; notes?: string }) =>
      request<CustomerSummary>("/customers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; email: string; phone: string; notes: string; loyaltyPoints: number }>) =>
      request<CustomerSummary>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    sync: () =>
      request<{ success: boolean; imported: number; updated: number; total: number }>(
        "/customers/sync",
        { method: "POST", body: "{}" },
      ),
  },
};

export type CustomerSummary = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
  tier: string;
  tierColor: string;
  tierBg: string;
  tierNextThreshold: number;
  tierProgress: number;
  visits: number;
  lastVisit: string | null;
  cloudPosId: string | null;
  notes: string | null;
  quoteCount: number;
  invoiceCount: number;
  orderCount: number;
  totalSpend: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDetail = CustomerSummary & {
  stats: {
    quoteCount: number;
    invoiceCount: number;
    orderCount: number;
    paidInvoiceCount: number;
    acceptedQuoteCount: number;
    totalSpend: number;
    avgQuoteAcceptDays: number | null;
    avgInvoicePayDays: number | null;
    topItems: Array<{ name: string; qty: number; spend: number }>;
  };
  quotes: Array<{ id: number; quoteNumber: string; status: string; total: number; createdAt: string }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; total: number; paidAt: string | null; createdAt: string }>;
  orders: Array<{ id: number; orderNumber: string; status: string; total: number; createdAt: string }>;
};
