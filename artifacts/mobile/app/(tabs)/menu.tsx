import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import type { Product } from "@/types/pos";
import BackButton from "@/components/BackButton";

const INDUSTRY_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  retail: "Retail",
  service: "Service",
};

const PRICING_LABELS: Record<string, string> = { fixed: "Fixed", hourly: "Hourly", weight: "By Weight", unit: "Per Unit" };

function getPricingTypes(industry: string): string[] {
  if (industry === "service") return ["fixed", "hourly"];
  if (industry === "restaurant") return ["fixed", "unit", "weight"];
  return ["fixed", "unit"];
}

const RESTAURANT_CATS = ["Appetizers", "Mains", "Desserts", "Beverages", "Specials", "Sides"];
const SERVICE_CATS    = ["Hair", "Nails", "Massage", "Skin", "Other Services"];
const RETAIL_CATS     = ["Clothing", "Accessories", "Electronics", "Food & Drink", "Other"];

function getSuggestedCategories(industry: string): string[] {
  if (industry === "restaurant") return RESTAURANT_CATS;
  if (industry === "service") return SERVICE_CATS;
  return RETAIL_CATS;
}

const EMOJIS = ["🍔","🍕","🥗","☕","🍰","🍺","🥩","🌮","🍜","🛍️","👕","💅","💆","✂️","📦","🎁","🍷","🥤","🧁","🍣"];

type ProductForm = {
  name: string;
  description: string;
  price: string;
  category: string;
  sku: string;
  emoji: string;
  pricingType: string;
};

const EMPTY_FORM: ProductForm = { name: "", description: "", price: "", category: "", sku: "", emoji: "", pricingType: "fixed" };

function ProductEditModal({
  visible,
  product,
  industry,
  colors,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  product: Product | null;
  industry: string;
  colors: typeof Colors.light;
  onClose: () => void;
  onSave: (form: ProductForm) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState(false);
  const suggestions = getSuggestedCategories(industry);
  const pricingTypes = getPricingTypes(industry);

  useEffect(() => {
    if (visible) {
      if (product) {
        const rawType = product.pricingType ?? "fixed";
        const resolvedType = pricingTypes.includes(rawType) ? rawType : "fixed";
        setForm({
          name: product.name,
          description: product.description ?? "",
          price: String(product.price),
          category: product.category,
          sku: product.sku ?? "",
          emoji: product.emoji ?? "",
          pricingType: resolvedType,
        });
        setCustomCategory(!suggestions.includes(product.category));
      } else {
        setForm(EMPTY_FORM);
        setCustomCategory(false);
      }
    }
  }, [visible, product]);

  const set = (key: keyof ProductForm, val: string) => setForm((f) => ({ ...f, [key]: val }));

  function handleSave() {
    if (!form.name.trim()) { Alert.alert("Validation", "Name is required"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { Alert.alert("Validation", "Enter a valid price"); return; }
    if (!form.category.trim()) { Alert.alert("Validation", "Category is required"); return; }
    onSave({ ...form, price: price.toFixed(2) });
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={mstyles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <Pressable style={[mstyles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[mstyles.sheetTitle, { color: colors.text }]}>
                {product ? "Edit Item" : "Add Item"}
              </Text>

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Name *</Text>
              <TextInput
                style={[mstyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Item name"
                placeholderTextColor={colors.textSecondary}
                value={form.name}
                onChangeText={(v) => set("name", v)}
                autoFocus={!product}
              />

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Price *</Text>
              <TextInput
                style={[mstyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={form.price}
                onChangeText={(v) => set("price", v)}
              />

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Pricing Type</Text>
              <View style={mstyles.chipRow}>
                {pricingTypes.map((pt) => (
                  <TouchableOpacity
                    key={pt}
                    style={[mstyles.chip, { backgroundColor: colors.surface }, form.pricingType === pt && { backgroundColor: colors.accent }]}
                    onPress={() => set("pricingType", pt)}
                  >
                    <Text style={[mstyles.chipText, { color: colors.textSecondary }, form.pricingType === pt && { color: "#fff" }]}>
                      {PRICING_LABELS[pt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Category *</Text>
              {!customCategory ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={mstyles.chipRow}>
                      {suggestions.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[mstyles.chip, form.category === c && { backgroundColor: colors.accent }]}
                          onPress={() => set("category", c)}
                        >
                          <Text style={[mstyles.chipText, form.category === c && { color: "#fff" }]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={[mstyles.chip, { borderStyle: "dashed" }]} onPress={() => setCustomCategory(true)}>
                        <Text style={[mstyles.chipText, { color: colors.accent }]}>+ Custom</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TextInput
                    style={[mstyles.input, { flex: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background, marginBottom: 0 }]}
                    placeholder="Custom category"
                    placeholderTextColor={colors.textSecondary}
                    value={form.category}
                    onChangeText={(v) => set("category", v)}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[mstyles.chip, { alignSelf: "center" }]}
                    onPress={() => { setCustomCategory(false); set("category", ""); }}
                  >
                    <Feather name="x" size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={mstyles.chipRow}>
                  {EMOJIS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      style={[mstyles.emojiBtn, form.emoji === e && { borderColor: colors.accent, borderWidth: 2 }]}
                      onPress={() => set("emoji", form.emoji === e ? "" : e)}
                    >
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[mstyles.input, mstyles.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Optional description"
                placeholderTextColor={colors.textSecondary}
                value={form.description}
                onChangeText={(v) => set("description", v)}
                multiline
                numberOfLines={2}
              />

              <Text style={[mstyles.label, { color: colors.textSecondary }]}>SKU</Text>
              <TextInput
                style={[mstyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Optional SKU / code"
                placeholderTextColor={colors.textSecondary}
                value={form.sku}
                onChangeText={(v) => set("sku", v)}
                autoCapitalize="characters"
              />

              <View style={mstyles.actions}>
                <TouchableOpacity style={[mstyles.cancelBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
                  <Text style={[mstyles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mstyles.saveBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={mstyles.saveText}>{isSaving ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function ProductCard({ product, index, onEdit, onDelete, colors }: {
  product: Product; index: number;
  onEdit: () => void; onDelete: () => void;
  colors: typeof Colors.light;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <TouchableOpacity
        style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onEdit}
        onLongPress={onDelete}
        activeOpacity={0.8}
      >
        <View style={[styles.productIcon, { backgroundColor: colors.accent + "15" }]}>
          {product.emoji ? (
            <Text style={styles.productEmoji}>{product.emoji}</Text>
          ) : (
            <Feather name="package" size={22} color={colors.accent} />
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            {product.name}
          </Text>
          {product.description ? (
            <Text style={[styles.productDesc, { color: colors.textSecondary }]} numberOfLines={1}>
              {product.description}
            </Text>
          ) : null}
          <View style={styles.productMeta}>
            <Text style={[styles.productCategory, { color: colors.textSecondary }]}>
              {product.category}
            </Text>
            {product.sku ? (
              <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                · {product.sku}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[styles.productPrice, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
            ${product.price.toFixed(2)}
          </Text>
          {product.pricingType !== "fixed" && (
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {PRICING_LABELS[product.pricingType] ?? product.pricingType}
            </Text>
          )}
          <TouchableOpacity onPress={onEdit} hitSlop={8}>
            <Feather name="edit-2" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MenuScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const { industry } = useSettings();
  const queryClient = useQueryClient();

  const screenTitle = industry === "retail" ? "Catalog" : "Menu";

  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  useEffect(() => {
    setSelectedCategory("All");
    setSearch("");
  }, [industry]);

  const { data: products, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["products", industry],
    queryFn: () => api.products.list(industry),
  });

  const createProduct = useMutation({
    mutationFn: (form: ProductForm) =>
      api.products.create({
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price),
        category: form.category,
        sku: form.sku || undefined,
        emoji: form.emoji || undefined,
        pricingType: form.pricingType,
        industry,
        isActive: true,
      }),
    onSuccess: () => {
      setEditModal(false);
      setEditProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, form }: { id: number; form: ProductForm }) =>
      api.products.update(id, {
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price),
        category: form.category,
        sku: form.sku || undefined,
        emoji: form.emoji || undefined,
        pricingType: form.pricingType,
      }),
    onSuccess: () => {
      setEditModal(false);
      setEditProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.products.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  function handleSave(form: ProductForm) {
    if (editProduct) {
      updateProduct.mutate({ id: editProduct.id, form });
    } else {
      createProduct.mutate(form);
    }
  }

  function handleDeletePress(product: Product) {
    Alert.alert(
      "Remove Item",
      `Remove "${product.name}" from the ${screenTitle.toLowerCase()}? It will be hidden from orders.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteProduct.mutate(product.id) },
      ]
    );
  }

  const categories = ["All", ...Array.from(new Set(products?.map((p) => p.category) ?? []))];

  const filtered = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <BackButton colors={colors} />
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {screenTitle}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[styles.industryBadge, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}>
              <Text style={[styles.industryBadgeText, { color: colors.accent, fontFamily: "Inter_500Medium" }]}>
                {INDUSTRY_LABEL[industry] ?? industry}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
              onPress={() => { setEditProduct(null); setEditModal(true); }}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
            placeholder={`Search ${screenTitle.toLowerCase()}…`}
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}
              style={[
                styles.catChip,
                {
                  backgroundColor: selectedCategory === cat ? colors.accent : colors.card,
                  borderColor: selectedCategory === cat ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.catText, { color: selectedCategory === cat ? "#fff" : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !filtered || filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{products?.length === 0 ? "📦" : "🔍"}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            {products?.length === 0 ? `No ${screenTitle.toLowerCase()} items` : "No results"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {products?.length === 0
              ? `Tap + to add your first ${screenTitle.toLowerCase()} item`
              : "Try a different search or category"}
          </Text>
          {products?.length === 0 && (
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: colors.accent }]}
              onPress={() => { setEditProduct(null); setEditModal(true); }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyAddText}>Add First Item</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <ProductCard
              product={item}
              index={index}
              colors={colors}
              onEdit={() => { setEditProduct(item); setEditModal(true); }}
              onDelete={() => handleDeletePress(item)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
          ]}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ProductEditModal
        visible={editModal}
        product={editProduct}
        industry={industry}
        colors={colors}
        onClose={() => { setEditModal(false); setEditProduct(null); }}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </View>
  );
}

const mstyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "92%" },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 16, textAlign: "center" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 2 },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569" },
  emojiBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", marginRight: 6 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 28, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  industryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  industryBadgeText: { fontSize: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 15 },
  categories: { flexDirection: "row", gap: 8, paddingVertical: 4, paddingRight: 20 },
  catChip: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5 },
  catText: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  productCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5 },
  productIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  productEmoji: { fontSize: 24 },
  productInfo: { flex: 1 },
  productName: { fontSize: 15 },
  productDesc: { fontSize: 12, marginTop: 2 },
  productMeta: { flexDirection: "row", gap: 4, marginTop: 3 },
  productCategory: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 },
  productSku: { fontSize: 11, opacity: 0.6 },
  productPrice: { fontSize: 17 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyAddText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
