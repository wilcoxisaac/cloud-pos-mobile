import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api, type PosAlert } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { useOffline } from "@/context/OfflineContext";
import type { Order } from "@/types/pos";
import BackButton from "@/components/BackButton";

type StatusFilter = "open" | "paid" | "voided" | "all";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "voided", label: "Voided" },
];

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const SEVERITY_COLORS = {
  high: "#D92D20",
  medium: "#B54708",
  low: "#027A48",
};

const SEVERITY_BG = {
  high: "#FEF3F2",
  medium: "#FFFAEB",
  low: "#ECFDF3",
};

function AlertBanner({
  alert,
  onDismiss,
  onAction,
  colors,
}: {
  alert: PosAlert;
  onDismiss: (id: string) => void;
  onAction: (alert: PosAlert) => void;
  colors: typeof Colors.light;
}) {
  const severityColor = SEVERITY_COLORS[alert.severity];
  const severityBg = SEVERITY_BG[alert.severity];
  const icons: Record<string, string> = {
    stale_open_order: "clock",
    high_void_rate: "alert-triangle",
    no_sales_today: "bar-chart-2",
    multiple_open_orders: "list",
  };
  const iconName = icons[alert.type] ?? "alert-circle";

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      exiting={FadeOutUp.springify()}
      style={[styles.alertBanner, { backgroundColor: severityBg, borderLeftColor: severityColor }]}
    >
      <View style={styles.alertLeft}>
        <View style={[styles.alertIconWrap, { backgroundColor: severityColor + "20" }]}>
          <Feather name={iconName as any} size={16} color={severityColor} />
        </View>
        <View style={styles.alertContent}>
          <Text style={[styles.alertTitle, { color: "#101828", fontFamily: "Inter_600SemiBold" }]}>
            {alert.title}
          </Text>
          <Text style={[styles.alertMessage, { color: "#475467" }]} numberOfLines={2}>
            {alert.message}
          </Text>
          {alert.actionLabel && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAction(alert);
              }}
              style={[styles.alertActionBtn, { borderColor: severityColor }]}
            >
              <Text style={[styles.alertActionText, { color: severityColor, fontFamily: "Inter_600SemiBold" }]}>
                {alert.actionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onDismiss(alert.id);
        }}
        style={styles.dismissBtn}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Feather name="x" size={16} color="#667085" />
      </TouchableOpacity>
    </Animated.View>
  );
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const { tableLabel } = useSettings();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/order/[id]", params: { id: order.id } });
  };

  const statusColor =
    order.status === "open"
      ? colors.warning
      : order.status === "paid"
      ? colors.success
      : colors.error;

  const statusLabel =
    order.status === "open" ? "OPEN" : order.status === "paid" ? "PAID" : "VOIDED";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={styles.orderCardTop}>
          <View>
            <Text style={[styles.orderNumber, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {order.orderNumber}
            </Text>
            {order.tableNumber ? (
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>
                {tableLabel} {order.tableNumber}
              </Text>
            ) : order.customerName ? (
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>
                {order.customerName}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        <View style={styles.orderCardBottom}>
          <View style={styles.itemCount}>
            <Feather name="shopping-bag" size={14} color={colors.textSecondary} />
            <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.timeAndTotal}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatTime(order.createdAt)}
            </Text>
            <Text style={[styles.totalText, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
              ${order.total.toFixed(2)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const { isOnline, queuedCount } = useOffline();

  const queryStatus = statusFilter === "all" ? undefined : statusFilter;

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: () => api.orders.list(queryStatus as any),
    refetchInterval: isOnline ? 15_000 : false,
    networkMode: "offlineFirst",
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.alerts.list(),
    refetchInterval: isOnline ? 60_000 : false,
    staleTime: 30_000,
    networkMode: "offlineFirst",
  });

  const visibleAlerts = (alertsData ?? []).filter((a) => !dismissedAlerts.has(a.id));

  const handleDismiss = useCallback(async (id: string) => {
    setDismissedAlerts((prev) => new Set([...prev, id]));
    try { await api.alerts.dismiss(id); } catch { /* ignore */ }
  }, []);

  const handleAlertAction = useCallback((alert: PosAlert) => {
    if (alert.type === "stale_open_order" && alert.actionData?.orderId) {
      router.push({ pathname: "/order/[id]", params: { id: alert.actionData.orderId as number } });
    } else if (alert.type === "multiple_open_orders") {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  }, [queryClient]);

  const handleNewOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/new-order");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const ListHeader = useCallback(() => (
    <>
      {visibleAlerts.length > 0 && (
        <View style={styles.alertsSection}>
          <View style={styles.alertsHeader}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={[styles.alertsHeaderText, { color: colors.error, fontFamily: "Inter_600SemiBold" }]}>
              {visibleAlerts.length} Alert{visibleAlerts.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {visibleAlerts.map((alert) => (
            <AlertBanner
              key={alert.id}
              alert={alert}
              onDismiss={handleDismiss}
              onAction={handleAlertAction}
              colors={colors}
            />
          ))}
        </View>
      )}
    </>
  ), [visibleAlerts, colors, handleDismiss, handleAlertAction]);

  const orderCount = orders?.length ?? 0;
  const activeDesc = statusFilter === "open"
    ? `${orderCount} active`
    : statusFilter === "all"
    ? `${orderCount} total`
    : `${orderCount} ${statusFilter}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInUp.springify()}
        style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}
      >
        <BackButton colors={colors} />
        <View style={{ flex: 1 }}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Orders
              </Text>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                {activeDesc}
                {visibleAlerts.length > 0 ? ` · ${visibleAlerts.length} alert${visibleAlerts.length !== 1 ? "s" : ""}` : ""}
                {!isOnline ? " · Offline" : queuedCount > 0 ? ` · ${queuedCount} pending` : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.newOrderBtn, { backgroundColor: colors.accent }]}
              onPress={handleNewOrder}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? colors.accent : colors.surface ?? colors.backgroundSecondary,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStatusFilter(f.id);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: active ? "#fff" : colors.textSecondary,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !orders || (orders.length === 0 && !visibleAlerts.length) ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            No {statusFilter === "all" ? "" : statusFilter + " "}orders
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {statusFilter === "open" ? "Tap + to start a new order" : "Try a different filter"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <OrderCard order={item} index={index} />}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {!isOnline && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.offlineBanner, { backgroundColor: colors.error }]}
        >
          <Feather name="wifi-off" size={14} color="#fff" />
          <Text style={[styles.offlineBannerText, { fontFamily: "Inter_600SemiBold" }]}>
            You're offline — showing cached data
            {queuedCount > 0 ? ` · ${queuedCount} change${queuedCount !== 1 ? "s" : ""} queued` : ""}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 2 },
  newOrderBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0072C4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pillsRow: {
    paddingBottom: 14,
    gap: 8,
    paddingRight: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  alertsSection: { marginBottom: 8 },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginLeft: 2,
  },
  alertsHeaderText: { fontSize: 13, letterSpacing: 0.2 },
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },
  alertLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 },
  alertIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  alertContent: { flex: 1, gap: 4 },
  alertTitle: { fontSize: 13 },
  alertMessage: { fontSize: 12, lineHeight: 17 },
  alertActionBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  alertActionText: { fontSize: 12 },
  dismissBtn: {
    padding: 2,
    marginLeft: 4,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderNumber: { fontSize: 16 },
  tableLabel: { fontSize: 13, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, letterSpacing: 0.5 },
  divider: { height: 0.5, marginHorizontal: 16 },
  orderCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemCountText: { fontSize: 13 },
  timeAndTotal: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeText: { fontSize: 13 },
  totalText: { fontSize: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 20, marginTop: 8 },
  emptyText: { fontSize: 15 },
  offlineBanner: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  offlineBannerText: { color: "#fff", fontSize: 13, flex: 1 },
});
