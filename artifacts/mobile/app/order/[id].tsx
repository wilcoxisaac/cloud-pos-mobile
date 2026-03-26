import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
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
import { useSettings } from "@/context/SettingsContext";
import type { Order } from "@/types/pos";

function InfoRow({ label, value, colors }: { label: string; value: string; colors: typeof Colors.light }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{value}</Text>
    </View>
  );
}

function OrderItemRow({ item, orderId, isOpen, colors }: {
  item: Order["items"][number];
  orderId: number;
  isOpen: boolean;
  colors: typeof Colors.light;
}) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => api.orders.removeItem(orderId, item.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", orderId], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove item"),
  });

  const handleRemove = () => {
    Alert.alert("Remove Item", `Remove ${item.productName} from order?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeMutation.mutate();
        },
      },
    ]);
  };

  return (
    <View style={[styles.itemRow, { borderBottomColor: colors.divider }]}>
      <View style={[styles.itemQtyBadge, { backgroundColor: colors.accent + "20" }]}>
        <Text style={[styles.itemQty, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
          {item.quantity}
        </Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
          {item.productName}
        </Text>
        {item.selectedModifiers && item.selectedModifiers.length > 0 ? (
          <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>
            {item.selectedModifiers.map((m) => m.optionName).join(", ")}
          </Text>
        ) : null}
        {item.notes ? (
          <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>📝 {item.notes}</Text>
        ) : null}
        {item.unitQuantity != null ? (
          <Text style={[styles.itemUnitPrice, { color: colors.textSecondary }]}>
            {item.unitQuantity} unit · ${item.productPrice.toFixed(2)}/unit
          </Text>
        ) : (
          <Text style={[styles.itemUnitPrice, { color: colors.textSecondary }]}>
            ${item.productPrice.toFixed(2)} each
          </Text>
        )}
      </View>
      <Text style={[styles.itemSubtotal, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
        ${item.subtotal.toFixed(2)}
      </Text>
      {isOpen && (
        <TouchableOpacity onPress={handleRemove} disabled={removeMutation.isPending}>
          {removeMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Feather name="trash-2" size={16} color={colors.error} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = parseInt(id ?? "0");
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { tableLabel } = useSettings();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.orders.get(orderId),
    enabled: !!orderId,
    refetchInterval: order?.status === "open" ? 10_000 : false,
  });

  const voidMutation = useMutation({
    mutationFn: () => api.orders.void(orderId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", orderId], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Failed to void order"),
  });

  const handleVoid = () => {
    Alert.alert("Void Order", "Are you sure you want to void this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Void",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          voidMutation.mutate();
        },
      },
    ]);
  };

  const handleCheckout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/checkout/[id]", params: { id: orderId } });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isOpen = order?.status === "open";

  const statusColor =
    order?.status === "open"
      ? colors.warning
      : order?.status === "paid"
      ? colors.success
      : colors.error;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>Order not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInUp.springify()}
        style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {order.orderNumber}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>
        {isOpen && (
          <TouchableOpacity onPress={handleVoid} style={styles.voidBtn}>
            <Feather name="x-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        )}
        {!isOpen && <View style={{ width: 40 }} />}
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: isOpen ? 120 + insets.bottom : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {(order.tableNumber || order.customerName) && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {order.tableNumber && (
                <InfoRow label={tableLabel} value={order.tableNumber} colors={colors} />
              )}
              {order.customerName && (
                <InfoRow label="Customer" value={order.customerName} colors={colors} />
              )}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
            ITEMS ({order.items.length})
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {order.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                orderId={orderId}
                isOpen={isOpen}
                colors={colors}
              />
            ))}
            {order.items.length === 0 && (
              <View style={styles.emptyItems}>
                <Text style={[styles.emptyItemsText, { color: colors.textSecondary }]}>
                  No items added yet
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(110).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
            TOTALS
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <InfoRow label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} colors={colors} />
            <InfoRow label="Tax (8%)" value={`$${order.tax.toFixed(2)}`} colors={colors} />
            <View style={[styles.infoRow, styles.totalRowBold]}>
              <Text style={[styles.infoLabel, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }]}>
                Total
              </Text>
              <Text style={[styles.infoValue, { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 20 }]}>
                ${order.total.toFixed(2)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {!isOpen && order.paymentMethod && (
          <Animated.View entering={FadeInDown.delay(130).springify()}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
              PAYMENT
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <InfoRow label="Method" value={order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)} colors={colors} />
              {order.amountTendered != null && (
                <InfoRow label="Tendered" value={`$${order.amountTendered.toFixed(2)}`} colors={colors} />
              )}
              {order.changeDue != null && order.changeDue > 0 && (
                <InfoRow label="Change" value={`$${order.changeDue.toFixed(2)}`} colors={colors} />
              )}
              {order.paidAt && (
                <InfoRow
                  label="Paid at"
                  value={new Date(order.paidAt).toLocaleString()}
                  colors={colors}
                />
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {isOpen && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.footer,
            {
              backgroundColor: colors.backgroundSecondary,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 16 : 8),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: colors.accent }]}
            onPress={handleCheckout}
            activeOpacity={0.85}
          >
            <Feather name="credit-card" size={20} color="#fff" />
            <Text style={[styles.checkoutText, { fontFamily: "Inter_700Bold" }]}>
              Charge ${order.total.toFixed(2)}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 17 },
  voidBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  totalRowBold: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  itemQtyBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemQty: { fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14 },
  itemNotes: { fontSize: 12, marginTop: 2 },
  itemUnitPrice: { fontSize: 12, marginTop: 2 },
  itemSubtotal: { fontSize: 15 },
  emptyItems: { paddingVertical: 20, alignItems: "center" },
  emptyItemsText: { fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#0072C4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  checkoutText: { color: "#fff", fontSize: 17 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16 },
});
