import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  RefreshControl,
  Switch,
  Share,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api, type QuoteDoc, type InvoiceDoc, type QuoteItem, type CustomerSummary } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import type { Product } from "@/types/pos";
import BackButton from "@/components/BackButton";

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDaysStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "paid" || status === "voided") return false;
  return new Date(dueDate + "T00:00:00") < new Date();
}

const QUOTE_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  draft:    { color: "#64748b", bg: "#f1f5f9", label: "Draft" },
  sent:     { color: "#0072C4", bg: "#EFF6FF", label: "Sent" },
  accepted: { color: "#16a34a", bg: "#f0fdf4", label: "Accepted" },
  declined: { color: "#dc2626", bg: "#fef2f2", label: "Declined" },
};

const INV_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  unpaid:  { color: "#d97706", bg: "#fffbeb", label: "Unpaid" },
  paid:    { color: "#16a34a", bg: "#f0fdf4", label: "Paid" },
  overdue: { color: "#dc2626", bg: "#fef2f2", label: "Overdue" },
  voided:  { color: "#94a3b8", bg: "#f1f5f9", label: "Voided" },
};

function StatusBadge({ status, isQuote }: { status: string; isQuote?: boolean }) {
  const meta = (isQuote ? QUOTE_STATUS_META : INV_STATUS_META)[status] ?? { color: "#64748b", bg: "#f1f5f9", label: status };
  return (
    <View style={[badge.pill, { backgroundColor: meta.bg }]}>
      <Text style={[badge.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

type LineItemForm = { productName: string; productPrice: string; quantity: string; notes: string };
const EMPTY_LINE: LineItemForm = { productName: "", productPrice: "", quantity: "1", notes: "" };

function LineItemEditor({
  items,
  onChange,
  colors,
  onBrowseCatalog,
}: {
  items: LineItemForm[];
  onChange: (items: LineItemForm[]) => void;
  colors: typeof Colors.light;
  onBrowseCatalog?: () => void;
}) {
  function update(idx: number, key: keyof LineItemForm, val: string) {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: val };
    onChange(next);
  }
  function add() { onChange([...items, { ...EMPTY_LINE }]); }
  function remove(idx: number) { onChange(items.filter((_, i) => i !== idx)); }

  return (
    <View>
      {items.map((it, idx) => (
        <View key={idx} style={[li.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={li.nameRow}>
            <TextInput
              style={[li.nameInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Item description *"
              placeholderTextColor={colors.textSecondary}
              value={it.productName}
              onChangeText={(v) => update(idx, "productName", v)}
            />
            {items.length > 1 && (
              <TouchableOpacity onPress={() => remove(idx)} hitSlop={8}>
                <Feather name="x" size={16} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>
          <View style={li.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[li.sublabel, { color: colors.textSecondary }]}>Unit Price *</Text>
              <TextInput
                style={[li.smallInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={it.productPrice}
                onChangeText={(v) => update(idx, "productPrice", v)}
              />
            </View>
            <View style={{ width: 70 }}>
              <Text style={[li.sublabel, { color: colors.textSecondary }]}>Qty *</Text>
              <TextInput
                style={[li.smallInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={it.quantity}
                onChangeText={(v) => update(idx, "quantity", v)}
              />
            </View>
          </View>
        </View>
      ))}
      <View style={li.addRow}>
        <TouchableOpacity style={[li.addBtn, { borderColor: "#0072C4", flex: 1 }]} onPress={add}>
          <Ionicons name="add" size={16} color="#0072C4" />
          <Text style={li.addText}>Item</Text>
        </TouchableOpacity>
        {onBrowseCatalog && (
          <TouchableOpacity style={[li.catalogBtn, { borderColor: "#0072C4" }]} onPress={onBrowseCatalog}>
            <Ionicons name="grid-outline" size={16} color="#0072C4" />
            <Text style={li.catalogText}>Browse Catalog</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const li = StyleSheet.create({
  row: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", borderBottomWidth: 1, paddingVertical: 4 },
  priceRow: { flexDirection: "row", gap: 8 },
  sublabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", marginBottom: 2 },
  smallInput: { fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1, borderRadius: 8, padding: 8 },
  addRow: { flexDirection: "row", gap: 8 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 12, justifyContent: "center" },
  addText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0072C4" },
  catalogBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 12, justifyContent: "center", flex: 1 },
  catalogText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0072C4" },
});

function ProductPickerSheet({
  visible,
  products,
  colors,
  onClose,
  onAddItem,
}: {
  visible: boolean;
  products: Product[];
  colors: typeof Colors.light;
  onClose: () => void;
  onAddItem: (item: { productId: number; productName: string; productPrice: number; quantity: number }) => void;
}) {
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  React.useEffect(() => {
    if (!visible) { setSearch(""); setQuantities({}); }
  }, [visible]);

  const filtered = products.filter(
    (p) =>
      p.isActive &&
      (search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()))
  );

  function getQty(id: number) { return quantities[id] ?? 1; }
  function setQty(id: number, qty: number) {
    if (qty < 1) return;
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={[ps.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[ps.headerTitle, { color: colors.text }]}>Product Catalog</Text>
          <Text style={[ps.headerSub, { color: colors.textSecondary }]}>Tap Add to include items</Text>
        </View>

        <View style={ps.searchWrap}>
          <View style={[ps.searchBox, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[ps.searchInput, { color: colors.text }]}
              placeholder="Search products…"
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: p }) => (
            <View style={[ps.productRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {p.emoji ? <Text style={ps.emoji}>{p.emoji}</Text> : null}
              <View style={{ flex: 1 }}>
                <Text style={[ps.productName, { color: colors.text }]}>{p.name}</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <Text style={ps.productPrice}>${p.price.toFixed(2)}</Text>
                  {p.category ? (
                    <Text style={[ps.productCat, { color: colors.textSecondary }]}>{p.category}</Text>
                  ) : null}
                </View>
              </View>
              <View style={ps.qtyRow}>
                <TouchableOpacity
                  onPress={() => setQty(p.id, getQty(p.id) - 1)}
                  style={[ps.qtyBtn, { backgroundColor: colors.backgroundSecondary }]}
                >
                  <Ionicons name="remove" size={14} color={colors.text} />
                </TouchableOpacity>
                <Text style={[ps.qtyNum, { color: colors.text }]}>{getQty(p.id)}</Text>
                <TouchableOpacity
                  onPress={() => setQty(p.id, getQty(p.id) + 1)}
                  style={[ps.qtyBtn, { backgroundColor: colors.backgroundSecondary }]}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  onAddItem({ productId: p.id, productName: p.name, productPrice: p.price, quantity: getQty(p.id) });
                  setQty(p.id, 1);
                }}
                style={ps.addBtn}
              >
                <Text style={ps.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60, gap: 10 }}>
              <Feather name="package" size={36} color={colors.textSecondary} />
              <Text style={[{ color: colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular" }]}>
                {search ? "No products match your search" : "No products in catalog"}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

function CatalogPickerContent({
  products,
  colors,
  onAddItem,
}: {
  products: Product[];
  colors: typeof Colors.light;
  onAddItem: (item: { productId: number; productName: string; productPrice: number; quantity: number }) => void;
}) {
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const filtered = products.filter(
    (p) =>
      p.isActive &&
      (search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()))
  );

  function getQty(id: number) { return quantities[id] ?? 1; }
  function setQty(id: number, qty: number) {
    if (qty < 1) return;
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  }

  return (
    <>
      <View style={ps.searchWrap}>
        <View style={[ps.searchBox, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[ps.searchInput, { color: colors.text }]}
            placeholder="Search products…"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: p }) => (
          <View style={[ps.productRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {p.emoji ? <Text style={ps.emoji}>{p.emoji}</Text> : null}
            <View style={{ flex: 1 }}>
              <Text style={[ps.productName, { color: colors.text }]}>{p.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
                <Text style={ps.productPrice}>${p.price.toFixed(2)}</Text>
                {p.category ? (
                  <Text style={[ps.productCat, { color: colors.textSecondary }]}>{p.category}</Text>
                ) : null}
              </View>
            </View>
            <View style={ps.qtyRow}>
              <TouchableOpacity
                onPress={() => setQty(p.id, getQty(p.id) - 1)}
                style={[ps.qtyBtn, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Ionicons name="remove" size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={[ps.qtyNum, { color: colors.text }]}>{getQty(p.id)}</Text>
              <TouchableOpacity
                onPress={() => setQty(p.id, getQty(p.id) + 1)}
                style={[ps.qtyBtn, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Ionicons name="add" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                onAddItem({ productId: p.id, productName: p.name, productPrice: p.price, quantity: getQty(p.id) });
                setQty(p.id, 1);
              }}
              style={ps.addBtn}
            >
              <Text style={ps.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60, gap: 10 }}>
            <Feather name="package" size={36} color={colors.textSecondary} />
            <Text style={[{ color: colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular" }]}>
              {search ? "No products match your search" : "No products in catalog"}
            </Text>
          </View>
        }
      />
    </>
  );
}

const ps = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  productRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  emoji: { fontSize: 26 },
  productName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  productPrice: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0072C4" },
  productCat: { fontSize: 11, fontFamily: "Inter_400Regular" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  qtyNum: { fontSize: 15, fontFamily: "Inter_600SemiBold", minWidth: 18, textAlign: "center" },
  addBtn: { backgroundColor: "#0072C4", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});

function CreateDocModal({
  visible, isQuote, industry, colors,
  onClose, onSave, isSaving,
}: {
  visible: boolean; isQuote: boolean; industry: string;
  colors: typeof Colors.light;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...EMPTY_LINE }]);
  const [dueDate, setDueDate] = useState(addDaysStr(30));
  const [validUntil, setValidUntil] = useState(addDaysStr(30));
  const [notes, setNotes] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list(),
    staleTime: 60_000,
  });

  const { data: existingCustomers = [] } = useQuery<CustomerSummary[]>({
    queryKey: ["customers"],
    queryFn: () => api.customers.list(),
    staleTime: 60_000,
    enabled: visible,
  });

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return existingCustomers;
    const q = customerSearch.toLowerCase();
    return existingCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q),
    );
  }, [existingCustomers, customerSearch]);

  React.useEffect(() => {
    if (visible) {
      setCustomer({ name: "", email: "", phone: "" });
      setLineItems([{ ...EMPTY_LINE }]);
      setDueDate(addDaysStr(30));
      setValidUntil(addDaysStr(30));
      setNotes("");
      setCatalogOpen(false);
      setCustomerPickerOpen(false);
      setCustomerSearch("");
    }
  }, [visible]);

  function handleAddFromCatalog(item: { productId: number; productName: string; productPrice: number; quantity: number }) {
    setLineItems((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.productName.trim() && !last.productPrice.trim()) {
        const next = [...prev];
        next[next.length - 1] = {
          productName: item.productName,
          productPrice: String(item.productPrice),
          quantity: String(item.quantity),
          notes: "",
        };
        return next;
      }
      return [...prev, {
        productName: item.productName,
        productPrice: String(item.productPrice),
        quantity: String(item.quantity),
        notes: "",
      }];
    });
  }

  function handleSave() {
    if (!customer.name.trim()) { Alert.alert("Validation", "Customer name is required"); return; }
    for (const it of lineItems) {
      if (!it.productName.trim()) { Alert.alert("Validation", "All items need a description"); return; }
      if (!it.productPrice || isNaN(parseFloat(it.productPrice))) { Alert.alert("Validation", "All items need a valid price"); return; }
      if (!it.quantity || parseInt(it.quantity) < 1) { Alert.alert("Validation", "Quantity must be at least 1"); return; }
    }
    onSave({
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim() || undefined,
      customerPhone: customer.phone.trim() || undefined,
      industry,
      notes: notes.trim() || undefined,
      ...(isQuote ? { validUntilDate: validUntil } : { dueDate }),
      items: lineItems.map((it) => ({
        productName: it.productName.trim(),
        productPrice: parseFloat(it.productPrice),
        quantity: parseInt(it.quantity),
        notes: it.notes.trim() || undefined,
      })),
    });
  }

  const docLabel = isQuote ? "Quote/Estimate" : "Invoice";

  if (customerPickerOpen) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={() => setCustomerPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
          <View style={[ps.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setCustomerPickerOpen(false); setCustomerSearch(""); }} hitSlop={8} style={{ marginRight: 12 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[ps.headerTitle, { color: colors.text }]}>Select Customer</Text>
            <Text style={[ps.headerSub, { color: colors.textSecondary }]}>Tap to auto-fill</Text>
          </View>
          <View style={[{ paddingHorizontal: 16, paddingVertical: 10 }]}>
            <View style={[ps.searchBox, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="search" size={15} color={colors.textSecondary} />
              <TextInput
                style={[ps.searchInput, { color: colors.text }]}
                placeholder="Search by name, email, phone…"
                placeholderTextColor={colors.textSecondary}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
          <FlatList
            data={filteredCustomers}
            keyExtractor={(c) => String(c.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[cpk.row, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => {
                  setCustomer({ name: item.name, email: item.email ?? "", phone: item.phone ?? "" });
                  setCustomerPickerOpen(false);
                  setCustomerSearch("");
                }}
                activeOpacity={0.7}
              >
                <View style={[cpk.avatar, { backgroundColor: "#0072C4" }]}>
                  <Text style={cpk.avatarText}>
                    {item.name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[cpk.name, { color: colors.text }]}>{item.name}</Text>
                  {item.email ? <Text style={[cpk.sub, { color: colors.textSecondary }]}>{item.email}</Text> : null}
                  {item.phone ? <Text style={[cpk.sub, { color: colors.textSecondary }]}>{item.phone}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[cpk.spend, { color: "#0072C4" }]}>${item.totalSpend.toFixed(0)}</Text>
                  <View style={[cpk.ptsBadge]}>
                    <Ionicons name="star" size={10} color="#0072C4" />
                    <Text style={cpk.ptsText}>{item.loyaltyPoints} pts</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 48, gap: 8 }}>
                <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>
                  {customerSearch ? "No customers match" : "No customers yet"}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          />
        </SafeAreaView>
      </Modal>
    );
  }

  if (catalogOpen) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={() => setCatalogOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
          <View style={[ps.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setCatalogOpen(false)} hitSlop={8} style={{ marginRight: 12 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[ps.headerTitle, { color: colors.text }]}>Product Catalog</Text>
            <Text style={[ps.headerSub, { color: colors.textSecondary }]}>Tap Add to include items</Text>
          </View>
          <CatalogPickerContent
            products={products}
            colors={colors}
            onAddItem={(item) => {
              handleAddFromCatalog(item);
              setCatalogOpen(false);
            }}
          />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={sh.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <Pressable style={[sh.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[sh.title, { color: colors.text }]}>New {docLabel}</Text>

              {existingCustomers.length > 0 && (
                <TouchableOpacity
                  style={[cpk.selectBtn, { borderColor: "#0072C4", backgroundColor: "#0072C408" }]}
                  onPress={() => setCustomerPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={16} color="#0072C4" />
                  <Text style={cpk.selectBtnText}>
                    {customer.name ? `${customer.name} — change` : "Select existing customer"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#0072C4" />
                </TouchableOpacity>
              )}

              <Text style={[sh.label, { color: colors.textSecondary }]}>Customer Name *</Text>
              <TextInput style={[sh.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Full name" placeholderTextColor={colors.textSecondary}
                value={customer.name} onChangeText={(v) => setCustomer((c) => ({ ...c, name: v }))} autoFocus={!existingCustomers.length} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[sh.label, { color: colors.textSecondary }]}>Email</Text>
                  <TextInput style={[sh.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="email@example.com" placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address" autoCapitalize="none"
                    value={customer.email} onChangeText={(v) => setCustomer((c) => ({ ...c, email: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sh.label, { color: colors.textSecondary }]}>Phone</Text>
                  <TextInput style={[sh.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="555-0100" placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    value={customer.phone} onChangeText={(v) => setCustomer((c) => ({ ...c, phone: v }))} />
                </View>
              </View>

              <Text style={[sh.label, { color: colors.textSecondary }]}>Line Items *</Text>
              <LineItemEditor
                items={lineItems}
                onChange={setLineItems}
                colors={colors}
                onBrowseCatalog={() => setCatalogOpen(true)}
              />

              <Text style={[sh.label, { color: colors.textSecondary }]}>
                {isQuote ? "Valid Until" : "Due Date"}
              </Text>
              <TextInput style={[sh.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary}
                value={isQuote ? validUntil : dueDate}
                onChangeText={isQuote ? setValidUntil : setDueDate} />

              <Text style={[sh.label, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput style={[sh.input, sh.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Optional notes" placeholderTextColor={colors.textSecondary}
                multiline numberOfLines={2}
                value={notes} onChangeText={setNotes} />

              <View style={sh.btns}>
                <TouchableOpacity style={[sh.cancelBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
                  <Text style={[sh.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sh.saveBtn, { opacity: isSaving ? 0.7 : 1 }]} onPress={handleSave} disabled={isSaving}>
                  <Text style={sh.saveText}>{isSaving ? "Creating…" : `Create ${docLabel}`}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function AcceptQuoteModal({
  quote, visible, colors,
  onClose, onAccept, isAccepting,
}: {
  quote: QuoteDoc | null; visible: boolean; colors: typeof Colors.light;
  onClose: () => void;
  onAccept: (acceptedIds: number[], dueDate: string) => void;
  isAccepting: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dueDate, setDueDate] = useState(addDaysStr(30));

  React.useEffect(() => {
    if (visible && quote) {
      setSelected(new Set(quote.items.map((i) => i.id)));
      setDueDate(addDaysStr(30));
    }
  }, [visible, quote]);

  if (!quote) return null;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const acceptedItems = quote.items.filter((i) => selected.has(i.id));
  const acceptedSubtotal = acceptedItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);

  function handleAccept() {
    if (selected.size === 0) { Alert.alert("Selection", "Select at least one item to accept"); return; }
    onAccept(Array.from(selected), dueDate);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={sh.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <Pressable style={[sh.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[sh.title, { color: colors.text }]}>Accept Quote</Text>
              <Text style={[{ color: colors.textSecondary, fontSize: 14, marginBottom: 16, fontFamily: "Inter_400Regular" }]}>
                Select which items {quote.customerName} is accepting. Unselected items won't appear on the invoice.
              </Text>

              {quote.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[itemRow.row, { backgroundColor: selected.has(item.id) ? colors.accent + "20" : colors.backgroundSecondary, borderColor: selected.has(item.id) ? colors.accent : colors.border }]}
                  onPress={() => toggle(item.id)}
                >
                  <View style={[itemRow.check, { backgroundColor: selected.has(item.id) ? colors.accent : "transparent", borderColor: selected.has(item.id) ? colors.accent : colors.border }]}>
                    {selected.has(item.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[itemRow.name, { color: colors.text }]}>{item.productName}</Text>
                    <Text style={[itemRow.qty, { color: colors.textSecondary }]}>
                      {item.quantity} × ${item.productPrice.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[itemRow.sub, { color: colors.text }]}>${item.subtotal.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}

              <View style={[itemRow.total, { borderTopColor: colors.border }]}>
                <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 14 }]}>
                  Accepted subtotal
                </Text>
                <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }]}>
                  ${acceptedSubtotal.toFixed(2)}
                </Text>
              </View>

              <Text style={[sh.label, { color: colors.textSecondary }]}>Invoice Due Date</Text>
              <TextInput
                style={[sh.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                value={dueDate}
                onChangeText={setDueDate}
              />

              <View style={sh.btns}>
                <TouchableOpacity style={[sh.cancelBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
                  <Text style={[sh.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sh.saveBtn, { opacity: isAccepting ? 0.7 : 1 }]} onPress={handleAccept} disabled={isAccepting}>
                  <Text style={sh.saveText}>{isAccepting ? "Creating Invoice…" : "Create Invoice"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const itemRow = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontFamily: "Inter_500Medium" },
  qty: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sub: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 4, marginBottom: 16 },
});

function QuoteCard({ quote, colors, onPress }: { quote: QuoteDoc; colors: typeof Colors.light; onPress: () => void }) {
  return (
    <TouchableOpacity style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={card.top}>
        <View>
          <Text style={[card.num, { color: colors.textSecondary }]}>{quote.quoteNumber}</Text>
          <Text style={[card.name, { color: colors.text }]}>{quote.customerName}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <StatusBadge status={quote.status} isQuote />
          <Text style={[card.total, { color: colors.accent }]}>${quote.total.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[card.bottom, { borderTopColor: colors.border }]}>
        <Text style={[card.meta, { color: colors.textSecondary }]}>
          {quote.items.length} item{quote.items.length !== 1 ? "s" : ""}
        </Text>
        {quote.validUntilDate && (
          <Text style={[card.meta, { color: colors.textSecondary }]}>
            Valid until {formatDate(quote.validUntilDate)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function InvoiceCard({ invoice, colors, onPress }: { invoice: InvoiceDoc; colors: typeof Colors.light; onPress: () => void }) {
  const overdue = isOverdue(invoice.dueDate, invoice.status);
  const displayStatus = overdue && invoice.status === "unpaid" ? "overdue" : invoice.status;
  return (
    <TouchableOpacity style={[card.wrap, { backgroundColor: colors.card, borderColor: overdue ? "#dc2626" : colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={card.top}>
        <View>
          <Text style={[card.num, { color: colors.textSecondary }]}>{invoice.invoiceNumber}</Text>
          <Text style={[card.name, { color: colors.text }]}>{invoice.customerName}</Text>
          {invoice.quoteId && (
            <Text style={[card.meta, { color: colors.textSecondary, marginTop: 2 }]}>From quote</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <StatusBadge status={displayStatus} />
          <Text style={[card.total, { color: colors.accent }]}>${invoice.total.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[card.bottom, { borderTopColor: colors.border }]}>
        <Text style={[card.meta, { color: colors.textSecondary }]}>
          {invoice.items.length} item{invoice.items.length !== 1 ? "s" : ""}
        </Text>
        {invoice.dueDate && (
          <Text style={[card.meta, { color: overdue ? "#dc2626" : colors.textSecondary }]}>
            Due {formatDate(invoice.dueDate)}
          </Text>
        )}
        {invoice.paidAt && (
          <Text style={[card.meta, { color: "#16a34a" }]}>
            Paid {formatDate(invoice.paidAt.slice(0, 10))}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  num: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  total: { fontSize: 17, fontFamily: "Inter_700Bold" },
  bottom: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

function DocDetailModal({
  doc, isQuote, visible, colors,
  onClose, onAccept, onMarkPaid, onDelete, onSend, isSending,
}: {
  doc: QuoteDoc | InvoiceDoc | null;
  isQuote: boolean;
  visible: boolean;
  colors: typeof Colors.light;
  onClose: () => void;
  onAccept?: () => void;
  onMarkPaid?: () => void;
  onDelete?: () => void;
  onSend?: () => void;
  isSending?: boolean;
}) {
  if (!doc) return null;
  const q = isQuote ? doc as QuoteDoc : null;
  const inv = !isQuote ? doc as InvoiceDoc : null;
  const overdue = inv ? isOverdue(inv.dueDate, inv.status) : false;
  const displayStatus = inv && overdue && inv.status === "unpaid" ? "overdue" : doc.status;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={sh.overlay} onPress={onClose}>
        <Pressable style={[sh.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={[sh.title, { color: colors.text, marginBottom: 0, textAlign: "left" }]}>
                {isQuote ? (doc as QuoteDoc).quoteNumber : (doc as InvoiceDoc).invoiceNumber}
              </Text>
              <StatusBadge status={displayStatus} isQuote={isQuote} />
            </View>

            <Text style={[{ color: colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16 }]}>
              {doc.customerName}
              {doc.customerEmail ? ` · ${doc.customerEmail}` : ""}
              {doc.customerPhone ? ` · ${doc.customerPhone}` : ""}
            </Text>

            <View style={[detail.infoBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {q && (
                <View style={detail.row}>
                  <Text style={[detail.key, { color: colors.textSecondary }]}>Valid Until</Text>
                  <Text style={[detail.val, { color: colors.text }]}>{formatDate(q.validUntilDate)}</Text>
                </View>
              )}
              {inv && (
                <View style={detail.row}>
                  <Text style={[detail.key, { color: colors.textSecondary }]}>Due Date</Text>
                  <Text style={[detail.val, { color: overdue ? "#dc2626" : colors.text }]}>{formatDate(inv.dueDate)}</Text>
                </View>
              )}
              <View style={[detail.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
                <Text style={[detail.key, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[detail.val, { color: colors.text }]}>${doc.subtotal.toFixed(2)}</Text>
              </View>
              <View style={detail.row}>
                <Text style={[detail.key, { color: colors.textSecondary }]}>Tax</Text>
                <Text style={[detail.val, { color: colors.text }]}>${doc.tax.toFixed(2)}</Text>
              </View>
              <View style={detail.row}>
                <Text style={[detail.key, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Total</Text>
                <Text style={[detail.val, { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 }]}>
                  ${doc.total.toFixed(2)}
                </Text>
              </View>
            </View>

            <Text style={[sh.label, { color: colors.textSecondary }]}>Line Items</Text>
            {doc.items.map((it, idx) => (
              <View key={idx} style={[detail.item, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: colors.text, fontFamily: "Inter_500Medium", fontSize: 14 }]}>{it.productName}</Text>
                  <Text style={[{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                    {it.quantity} × ${it.productPrice.toFixed(2)}
                  </Text>
                </View>
                <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold" }]}>${it.subtotal.toFixed(2)}</Text>
              </View>
            ))}

            {doc.notes && (
              <View style={{ marginTop: 12 }}>
                <Text style={[sh.label, { color: colors.textSecondary }]}>Notes</Text>
                <Text style={[{ color: colors.text, fontSize: 14, fontFamily: "Inter_400Regular" }]}>{doc.notes}</Text>
              </View>
            )}

            <View style={{ gap: 10, marginTop: 20 }}>
              {q && (q.status === "draft" || q.status === "sent") && onSend && (
                <TouchableOpacity
                  style={[actionBtn.btn, { backgroundColor: "#0072C4", opacity: isSending ? 0.7 : 1 }]}
                  onPress={onSend}
                  disabled={isSending}
                >
                  {isSending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="send" size={16} color="#fff" />
                  }
                  <Text style={actionBtn.text}>
                    {isSending ? "Sending…" : (q.customerEmail ? "Email Quote to Customer" : "Get Quote Link")}
                  </Text>
                </TouchableOpacity>
              )}
              {q && (q.status === "draft" || q.status === "sent") && onAccept && (
                <TouchableOpacity style={[actionBtn.btn, { backgroundColor: "#16a34a" }]} onPress={onAccept}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text style={actionBtn.text}>Customer Accepts — Create Invoice</Text>
                </TouchableOpacity>
              )}
              {inv && (inv.status === "unpaid" || isOverdue(inv.dueDate, inv.status)) && onSend && (
                <TouchableOpacity
                  style={[actionBtn.btn, { backgroundColor: "#0072C4", opacity: isSending ? 0.7 : 1 }]}
                  onPress={onSend}
                  disabled={isSending}
                >
                  {isSending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="send" size={16} color="#fff" />
                  }
                  <Text style={actionBtn.text}>
                    {isSending ? "Sending…" : (inv.customerEmail ? "Email Invoice to Customer" : "Get Invoice Link")}
                  </Text>
                </TouchableOpacity>
              )}
              {inv && inv.status === "unpaid" && onMarkPaid && (
                <TouchableOpacity style={[actionBtn.btn, { backgroundColor: "#16a34a" }]} onPress={onMarkPaid}>
                  <Ionicons name="cash-outline" size={16} color="#fff" />
                  <Text style={actionBtn.text}>Mark as Paid</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={[actionBtn.btn, { backgroundColor: "#fef2f2" }]} onPress={onDelete}>
                  <Feather name="trash-2" size={16} color="#dc2626" />
                  <Text style={[actionBtn.text, { color: "#dc2626" }]}>
                    {isQuote ? "Delete Quote" : "Void Invoice"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[actionBtn.btn, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
                <Text style={[actionBtn.text, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const actionBtn = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, justifyContent: "center" },
  text: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
const detail = StyleSheet.create({
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  key: { fontSize: 13, fontFamily: "Inter_400Regular" },
  val: { fontSize: 13, fontFamily: "Inter_500Medium" },
  item: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
});

export default function InvoicesScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const { industry } = useSettings();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"quotes" | "invoices">("quotes");
  const [quoteFilter, setQuoteFilter] = useState("All");
  const [invoiceFilter, setInvoiceFilter] = useState("All");
  const [createModal, setCreateModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteDoc | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDoc | null>(null);
  const [acceptModal, setAcceptModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);

  const { data: quotes, isLoading: qLoading, isRefetching: qRefetching, refetch: refetchQ } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => api.quotes.list(),
  });

  const { data: invoices, isLoading: iLoading, isRefetching: iRefetching, refetch: refetchI } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.invoices.list(),
  });

  const createQuote = useMutation({
    mutationFn: (data: any) => api.quotes.create(data),
    onSuccess: () => { setCreateModal(false); queryClient.invalidateQueries({ queryKey: ["quotes"] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createInvoice = useMutation({
    mutationFn: (data: any) => api.invoices.create(data),
    onSuccess: () => { setCreateModal(false); queryClient.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const acceptQuote = useMutation({
    mutationFn: ({ id, ids, due }: { id: number; ids: number[]; due: string }) =>
      api.quotes.accept(id, { acceptedItemIds: ids, dueDate: due }),
    onSuccess: () => {
      setAcceptModal(false);
      setDetailModal(false);
      setSelectedQuote(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setView("invoices");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const sendQuote = useMutation({
    mutationFn: (id: number) => api.quotes.send(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setDetailModal(false);
      setSelectedQuote(null);
      const hasMail = result.customerEmail;
      const title = result.emailSent ? "Quote Sent!" : (hasMail ? "Quote Link Ready" : "Quote Link Ready");
      const body = result.emailSent
        ? `Email sent to ${result.customerEmail}.\n\nCustomer portal link:\n${result.portalUrl}`
        : `${hasMail ? `Could not send email to ${result.customerEmail}.\n\n` : ""}Share this link with your customer:\n${result.portalUrl}`;
      if (result.portalUrl) {
        Share.share({ message: body, url: result.portalUrl }).catch(() =>
          Alert.alert(title, body)
        );
      } else {
        Alert.alert(title, body);
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const sendInvoice = useMutation({
    mutationFn: (id: number) => api.invoices.send(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setDetailModal(false);
      setSelectedInvoice(null);
      const hasMail = result.customerEmail;
      const title = result.emailSent ? "Invoice Sent!" : "Invoice Link Ready";
      const body = result.emailSent
        ? `Email sent to ${result.customerEmail}.\n\nCustomer portal link:\n${result.portalUrl}`
        : `${hasMail ? `Could not send email to ${result.customerEmail}.\n\n` : ""}Share this link with your customer:\n${result.portalUrl}`;
      if (result.portalUrl) {
        Share.share({ message: body, url: result.portalUrl }).catch(() =>
          Alert.alert(title, body)
        );
      } else {
        Alert.alert(title, body);
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => api.invoices.pay(id),
    onSuccess: () => { setDetailModal(false); setSelectedInvoice(null); queryClient.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteQuote = useMutation({
    mutationFn: (id: number) => api.quotes.delete(id),
    onSuccess: () => { setDetailModal(false); setSelectedQuote(null); queryClient.invalidateQueries({ queryKey: ["quotes"] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: (id: number) => api.invoices.delete(id),
    onSuccess: () => { setDetailModal(false); setSelectedInvoice(null); queryClient.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  function handleDeleteQuote(q: QuoteDoc) {
    Alert.alert("Delete Quote", `Delete ${q.quoteNumber}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteQuote.mutate(q.id) },
    ]);
  }

  function handleVoidInvoice(inv: InvoiceDoc) {
    Alert.alert("Void Invoice", `Void ${inv.invoiceNumber}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Void", style: "destructive", onPress: () => deleteInvoice.mutate(inv.id) },
    ]);
  }

  const isCreating = createQuote.isPending || createInvoice.isPending;
  const isLoading = view === "quotes" ? qLoading : iLoading;
  const isRefetching = view === "quotes" ? qRefetching : iRefetching;
  const refetch = view === "quotes" ? refetchQ : refetchI;

  const QUOTE_FILTERS = ["All", "Draft", "Sent", "Accepted", "Declined"];
  const INVOICE_FILTERS = ["All", "Unpaid", "Paid", "Overdue", "Voided"];

  const filteredQuotes = (quotes ?? []).filter((q) => {
    if (quoteFilter === "All") return true;
    return q.status === quoteFilter.toLowerCase();
  });

  const filteredInvoices = (invoices ?? []).filter((inv) => {
    if (invoiceFilter === "All") return true;
    if (invoiceFilter === "Overdue") return isOverdue(inv.dueDate, inv.status);
    return inv.status === invoiceFilter.toLowerCase();
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Invoices</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[styles.segControl, { backgroundColor: colors.backgroundSecondary }]}>
            <TouchableOpacity
              style={[styles.seg, view === "quotes" && { backgroundColor: colors.accent }]}
              onPress={() => setView("quotes")}
            >
              <Text style={[styles.segText, view === "quotes" && { color: "#fff" }]}>Quotes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.seg, view === "invoices" && { backgroundColor: colors.accent }]}
              onPress={() => setView("invoices")}
            >
              <Text style={[styles.segText, view === "invoices" && { color: "#fff" }]}>Invoices</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => setCreateModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {(view === "quotes" ? QUOTE_FILTERS : INVOICE_FILTERS).map((f) => {
            const active = view === "quotes" ? quoteFilter === f : invoiceFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => view === "quotes" ? setQuoteFilter(f) : setInvoiceFilter(f)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.accent : colors.card,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? "#fff" : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 80 }} />
      ) : view === "quotes" ? (
        <FlatList
          data={filteredQuotes}
          keyExtractor={(q) => String(q.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={qRefetching} onRefresh={refetchQ} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <QuoteCard
              quote={item}
              colors={colors}
              onPress={() => { setSelectedQuote(item); setDetailModal(true); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="file-text" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {quoteFilter === "All" ? "No quotes yet" : `No ${quoteFilter.toLowerCase()} quotes`}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {quoteFilter === "All"
                  ? "Tap + to create your first quote or estimate"
                  : "Try a different filter or create a new quote"}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(inv) => String(inv.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={iRefetching} onRefresh={refetchI} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <InvoiceCard
              invoice={item}
              colors={colors}
              onPress={() => { setSelectedInvoice(item); setDetailModal(true); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="dollar-sign" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {invoiceFilter === "All" ? "No invoices yet" : `No ${invoiceFilter.toLowerCase()} invoices`}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {invoiceFilter === "All"
                  ? "Accept a quote or tap + to create a direct invoice"
                  : "Try a different filter or create a new invoice"}
              </Text>
            </View>
          }
        />
      )}

      <CreateDocModal
        visible={createModal}
        isQuote={view === "quotes"}
        industry={industry}
        colors={colors}
        onClose={() => setCreateModal(false)}
        onSave={(data) => view === "quotes" ? createQuote.mutate(data) : createInvoice.mutate(data)}
        isSaving={isCreating}
      />

      <DocDetailModal
        doc={selectedQuote}
        isQuote
        visible={detailModal && !!selectedQuote}
        colors={colors}
        onClose={() => { setDetailModal(false); setSelectedQuote(null); }}
        onSend={() => selectedQuote && sendQuote.mutate(selectedQuote.id)}
        isSending={sendQuote.isPending}
        onAccept={() => { setDetailModal(false); setAcceptModal(true); }}
        onDelete={() => selectedQuote && handleDeleteQuote(selectedQuote)}
      />

      <DocDetailModal
        doc={selectedInvoice}
        isQuote={false}
        visible={detailModal && !!selectedInvoice}
        colors={colors}
        onClose={() => { setDetailModal(false); setSelectedInvoice(null); }}
        onSend={() => selectedInvoice && sendInvoice.mutate(selectedInvoice.id)}
        isSending={sendInvoice.isPending}
        onMarkPaid={() => selectedInvoice && markPaid.mutate(selectedInvoice.id)}
        onDelete={() => selectedInvoice && handleVoidInvoice(selectedInvoice)}
      />

      <AcceptQuoteModal
        quote={selectedQuote}
        visible={acceptModal}
        colors={colors}
        onClose={() => setAcceptModal(false)}
        onAccept={(ids, due) => selectedQuote && acceptQuote.mutate({ id: selectedQuote.id, ids, due })}
        isAccepting={acceptQuote.isPending}
      />
    </SafeAreaView>
  );
}

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "92%" },
  title: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 16, textAlign: "center" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 2 },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  btns: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#0072C4" },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const cpk = StyleSheet.create({
  selectBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 12, marginBottom: 4 },
  selectBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#0072C4" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  spend: { fontSize: 13, fontFamily: "Inter_700Bold" },
  ptsBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ptsText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#0072C4" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
    gap: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  segControl: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingBottom: 120 },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  filterBarWrapper: { paddingHorizontal: 16, paddingBottom: 4 },
  filterBar: { flexDirection: "row", gap: 8, paddingRight: 4, paddingVertical: 4 },
  filterChip: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5 },
  filterChipText: { fontSize: 13 },
});
