import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  SectionList,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type KitchenTicket } from "@/lib/api";
import Colors from "@/constants/colors";
import BackButton from "@/components/BackButton";

const KITCHEN_STATUS_META: Record<
  KitchenTicket["kitchenStatus"],
  { label: string; color: string; bg: string; barColor: string; nextLabel: string; nextStatus: string | null }
> = {
  new:       { label: "New Order",  color: "#991B1B", bg: "#FEF2F2", barColor: "#EF4444", nextLabel: "Start",       nextStatus: "preparing" },
  preparing: { label: "Preparing",  color: "#92400E", bg: "#FFFBEB", barColor: "#F59E0B", nextLabel: "Mark Ready",  nextStatus: "ready" },
  ready:     { label: "Ready",      color: "#166534", bg: "#F0FDF4", barColor: "#22C55E", nextLabel: "Served",       nextStatus: "served" },
  served:    { label: "Served",     color: "#374151", bg: "#F9FAFB", barColor: "#9CA3AF", nextLabel: "",             nextStatus: null },
};

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function TicketCard({
  ticket,
  colors,
  onAdvance,
  isLoading,
}: {
  ticket: KitchenTicket;
  colors: typeof Colors.light;
  onAdvance: (id: number, nextStatus: string) => void;
  isLoading: boolean;
}) {
  const meta = KITCHEN_STATUS_META[ticket.kitchenStatus] ?? KITCHEN_STATUS_META.new;
  const mins = minutesSince(ticket.createdAt);
  const [elapsed, setElapsed] = useState(mins);

  useEffect(() => {
    const id = setInterval(() => setElapsed(minutesSince(ticket.createdAt)), 30_000);
    return () => clearInterval(id);
  }, [ticket.createdAt]);

  return (
    <View style={[styles.ticket, { backgroundColor: meta.bg }]}>
      <View style={[styles.ticketBar, { backgroundColor: meta.barColor }]} />
      <View style={styles.ticketContent}>
        <View style={styles.ticketHeader}>
          <View>
            <Text style={[styles.ticketOrder, { color: colors.text }]}>#{ticket.orderNumber}</Text>
            {ticket.tableNumber ? (
              <Text style={[styles.ticketTable, { color: colors.textSecondary }]}>
                Table {ticket.tableNumber}
                {ticket.guestCount ? ` · ${ticket.guestCount} guests` : ""}
              </Text>
            ) : ticket.customerName ? (
              <Text style={[styles.ticketTable, { color: colors.textSecondary }]}>{ticket.customerName}</Text>
            ) : null}
          </View>
          <View style={styles.ticketTimeWrap}>
            <Ionicons name="time-outline" size={14} color={meta.color} />
            <Text style={[styles.ticketTime, { color: meta.color }]}>{elapsed}m</Text>
          </View>
        </View>

        <View style={styles.itemsWrap}>
          {ticket.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.itemQty, { color: meta.barColor }]}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.productName}</Text>
                {item.notes ? (
                  <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>{item.notes}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {meta.nextStatus && (
          <TouchableOpacity
            style={[styles.advanceBtn, { backgroundColor: meta.barColor }]}
            onPress={() => onAdvance(ticket.id, meta.nextStatus!)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.advanceBtnText}>{meta.nextLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function KitchenScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<KitchenTicket["kitchenStatus"] | null>(null);

  const { data: tickets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["kitchen"],
    queryFn: () => api.kitchen.list(),
    refetchInterval: 15_000,
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.kitchen.updateStatus(id, status),
    onMutate: ({ id }) => setLoadingId(id),
    onSettled: () => {
      setLoadingId(null);
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    },
  });

  const new_ = tickets?.filter((t) => t.kitchenStatus === "new") ?? [];
  const preparing = tickets?.filter((t) => t.kitchenStatus === "preparing") ?? [];
  const ready = tickets?.filter((t) => t.kitchenStatus === "ready") ?? [];

  const allSections = [
    { title: "New Orders", key: "new" as const, data: new_, barColor: "#EF4444", statColor: "#EF4444" },
    { title: "Preparing",  key: "preparing" as const, data: preparing, barColor: "#F59E0B", statColor: "#F59E0B" },
    { title: "Ready",      key: "ready" as const, data: ready, barColor: "#22C55E", statColor: "#22C55E" },
  ];

  const sections = allSections
    .filter((s) => !statusFilter || s.key === statusFilter)
    .filter((s) => s.data.length > 0);

  const total = (tickets ?? []).length;

  function toggleFilter(key: KitchenTicket["kitchenStatus"]) {
    setStatusFilter((prev) => (prev === key ? null : key));
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Kitchen Display</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Live ticket view · auto-refresh 15s</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.statItem, !statusFilter && styles.statItemActive]}
          onPress={() => setStatusFilter(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.statCount, { color: colors.text }]}>{total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          {!statusFilter && <View style={[styles.statUnderline, { backgroundColor: colors.accent }]} />}
        </TouchableOpacity>
        {allSections.map((s) => {
          const active = statusFilter === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.statItem, active && styles.statItemActive]}
              onPress={() => toggleFilter(s.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.statCount, { color: s.statColor, opacity: statusFilter && !active ? 0.4 : 1 }]}>
                {s.data.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, opacity: statusFilter && !active ? 0.4 : 1 }]}>
                {s.title}
              </Text>
              {active && <View style={[styles.statUnderline, { backgroundColor: s.barColor }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {total === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active kitchen tickets</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
          }
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section: { title, barColor } }) => (
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: barColor }]} />
              <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              colors={colors}
              onAdvance={(id, status) => advance.mutate({ id, status })}
              isLoading={loadingId === item.id}
            />
          )}
          stickySectionHeadersEnabled
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshBtn: { padding: 8 },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: "center", paddingBottom: 8, paddingTop: 2 },
  statItemActive: {},
  statUnderline: { position: "absolute", bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  statCount: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 120 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
    paddingVertical: 8,
    marginBottom: 4,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  ticket: {
    flexDirection: "row",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  ticketBar: { width: 5 },
  ticketContent: { flex: 1, padding: 14 },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  ticketOrder: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  ticketTable: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  ticketTimeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  ticketTime: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemsWrap: { gap: 6, marginBottom: 12 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemQty: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 28 },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemNotes: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2 },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  advanceBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
