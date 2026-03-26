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
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { ModifierSheet } from "@/components/ModifierSheet";
import type { Product, SelectedModifier } from "@/types/pos";

const TAX_RATE = 0.08;

function ProductTile({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const { items } = useCart();
  const inCart = items.filter((i) => i.product.id === product.id);
  const totalQty = inCart.reduce((s, i) => s + i.quantity, 0);
  const isHourly = product.pricingType === "hourly";
  const isWeight = product.pricingType === "weight";

  return (
    <TouchableOpacity
      style={[
        styles.productTile,
        {
          backgroundColor: colors.card,
          borderColor: totalQty > 0 ? colors.accent : colors.border,
          borderWidth: totalQty > 0 ? 1.5 : 0.5,
        },
      ]}
      onPress={() => onAdd(product)}
      activeOpacity={0.75}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.accent + "15" }]}>
        {product.emoji ? (
          <Text style={{ fontSize: 20 }}>{product.emoji}</Text>
        ) : (
          <Feather name="package" size={20} color={colors.accent} />
        )}
      </View>
      <Text style={[styles.tileName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={[styles.tilePrice, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
          ${product.price.toFixed(2)}
        </Text>
        {(isHourly || isWeight) && (
          <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>
            /{product.unit ?? (isHourly ? "hr" : "unit")}
          </Text>
        )}
      </View>
      {totalQty > 0 ? (
        <View style={[styles.tileQty, { backgroundColor: colors.accent }]}>
          <Text style={styles.tileQtyText}>{totalQty}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CartSheet({
  colors,
  insets,
  tableNumber,
  customerName,
  onPlaceOrder,
  isLoading,
}: {
  colors: typeof Colors.light;
  insets: ReturnType<typeof useSafeAreaInsets>;
  tableNumber: string;
  customerName: string;
  onPlaceOrder: () => void;
  isLoading: boolean;
}) {
  const { items, removeItem, updateQuantity, subtotal, tax, total, itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.cartSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <ScrollView
        style={styles.cartScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.map((item) => {
          const effectiveQty = item.unitQuantity != null ? item.unitQuantity : item.quantity;
          const lineTotal = item.product.price * effectiveQty;
          const modSummary = item.selectedModifiers && item.selectedModifiers.length > 0
            ? item.selectedModifiers.map((m) => m.optionName).join(", ")
            : null;
          const isUnitBased = item.unitQuantity != null;
          return (
            <View
              key={item.itemKey}
              style={[styles.cartItem, { borderBottomColor: colors.divider }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cartItemName, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                  {item.product.name}
                </Text>
                {modSummary ? (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                    {modSummary}
                  </Text>
                ) : null}
                {isUnitBased ? (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>
                    {item.unitQuantity} {item.product.unit ?? "unit"} × ${item.product.price.toFixed(2)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cartItemRight}>
                {!isUnitBased && (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateQuantity(item.itemKey, item.quantity - 1);
                      }}
                      style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                    >
                      <Feather name="minus" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyNum, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {item.quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateQuantity(item.itemKey, item.quantity + 1);
                      }}
                      style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                    >
                      <Feather name="plus" size={14} color={colors.text} />
                    </TouchableOpacity>
                  </>
                )}
                <Text style={[styles.cartItemTotal, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
                  ${lineTotal.toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeItem(item.itemKey);
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.cartTotals, { borderTopColor: colors.divider }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Tax (8%)</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>${tax.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabelBold, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            Total
          </Text>
          <Text style={[styles.totalValueBold, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
            ${total.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.placeOrderBtn, { backgroundColor: colors.accent, opacity: isLoading ? 0.7 : 1 }]}
          onPress={onPlaceOrder}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={[styles.placeOrderText, { fontFamily: "Inter_700Bold" }]}>
                Place Order
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function NewOrderScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { items, addItem, clearCart, total } = useCart();
  const { industry, tableLabel } = useSettings();
  const params = useLocalSearchParams<{ tableNumber?: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tableNumber, setTableNumber] = useState(params.tableNumber ?? "");
  const [customerName, setCustomerName] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", industry],
    queryFn: () => api.products.list(industry),
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.orders.create>[0]) => api.orders.create(data),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      clearCart();
      router.replace({ pathname: "/order/[id]", params: { id: order.id } });
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to place order");
    },
  });

  const categories = ["All", ...Array.from(new Set(products?.map((p) => p.category) ?? []))];

  const filtered = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddProduct = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingProduct(product);
  };

  const handleModifierConfirm = (result: {
    selectedModifiers: SelectedModifier[];
    notes: string;
    unitQuantity?: number | null;
  }) => {
    if (!pendingProduct) return;
    addItem(pendingProduct, {
      quantity: 1,
      unitQuantity: result.unitQuantity,
      notes: result.notes || undefined,
      selectedModifiers: result.selectedModifiers.length > 0 ? result.selectedModifiers : undefined,
    });
    setPendingProduct(null);
  };

  const handlePlaceOrder = () => {
    if (items.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createOrderMutation.mutate({
      tableNumber: tableNumber || null,
      guestCount: guestCount ? parseInt(guestCount, 10) : null,
      customerName: customerName || null,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitQuantity: i.unitQuantity ?? null,
        notes: i.notes || null,
        selectedModifiers: i.selectedModifiers,
      })),
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View>
        <Animated.View entering={FadeInUp.springify()} style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity
            onPress={() => {
              clearCart();
              router.back();
            }}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            New Order
          </Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <View style={styles.detailsRow}>
          <View style={[styles.detailInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={industry === "service" ? "user" : "hash"} size={14} color={colors.textSecondary} />
            <TextInput
              style={[styles.detailText, { color: colors.text }]}
              placeholder={industry === "service" ? tableLabel : `${tableLabel} #`}
              placeholderTextColor={colors.textSecondary}
              value={tableNumber}
              onChangeText={setTableNumber}
            />
          </View>
          {industry === "restaurant" ? (
            <View style={[styles.detailInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              <TextInput
                style={[styles.detailText, { color: colors.text }]}
                placeholder="Guests"
                placeholderTextColor={colors.textSecondary}
                value={guestCount}
                onChangeText={setGuestCount}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          ) : (
            <View style={[styles.detailInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={14} color={colors.textSecondary} />
              <TextInput
                style={[styles.detailText, { color: colors.text }]}
                placeholder="Customer name"
                placeholderTextColor={colors.textSecondary}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>
          )}
        </View>
        {industry !== "restaurant" ? null : (
          <View style={[styles.detailsRow, { marginTop: -4 }]}>
            <View style={[styles.detailInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={14} color={colors.textSecondary} />
              <TextInput
                style={[styles.detailText, { color: colors.text }]}
                placeholder="Customer name"
                placeholderTextColor={colors.textSecondary}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>
          </View>
        )}

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search menu..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat);
            }}
            style={[
              styles.catChip,
              {
                backgroundColor: selectedCategory === cat ? colors.accent : colors.card,
                borderColor: selectedCategory === cat ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.catText,
                {
                  color: selectedCategory === cat ? "#fff" : colors.textSecondary,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </View>

      {productsLoading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.tileRow}
          renderItem={({ item }) => (
            <ProductTile product={item} onAdd={handleAddProduct} />
          )}
          contentContainerStyle={[
            styles.tileList,
            {
              paddingBottom:
                items.length > 0
                  ? 300 + insets.bottom
                  : insets.bottom + (Platform.OS === "web" ? 34 : 20),
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="package" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No items found
              </Text>
            </View>
          }
        />
      )}

      {items.length > 0 && (
        <CartSheet
          colors={colors}
          insets={insets}
          tableNumber={tableNumber}
          customerName={customerName}
          onPlaceOrder={handlePlaceOrder}
          isLoading={createOrderMutation.isPending}
        />
      )}

      <ModifierSheet
        product={pendingProduct}
        visible={!!pendingProduct}
        colors={colors}
        onConfirm={handleModifierConfirm}
        onCancel={() => setPendingProduct(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20 },
  detailsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  detailInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  detailText: { flex: 1, fontSize: 14 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categories: { flexDirection: "row", gap: 8, paddingVertical: 4, paddingHorizontal: 16, paddingRight: 20 },
  catChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  catText: { fontSize: 12 },
  tileList: { paddingHorizontal: 16, paddingTop: 4 },
  tileRow: { gap: 10, marginBottom: 10 },
  productTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    position: "relative",
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { fontSize: 14, lineHeight: 18 },
  tilePrice: { fontSize: 16 },
  tileQty: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileQtyText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  cartSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 320,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  cartScroll: { maxHeight: 160, paddingHorizontal: 16 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  cartItemName: { flex: 1, fontSize: 14 },
  cartItemRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNum: { fontSize: 15, minWidth: 16, textAlign: "center" },
  cartItemTotal: { fontSize: 14, minWidth: 52, textAlign: "right" },
  cartTotals: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 0.5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 13 },
  totalLabelBold: { fontSize: 16 },
  totalValueBold: { fontSize: 20 },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: "#0072C4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  placeOrderText: { color: "#fff", fontSize: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
