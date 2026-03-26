import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import type { Order } from "@/types/pos";
import BackButton from "@/components/BackButton";

const filters = [
  { label: "All", value: undefined },
  { label: "Paid", value: "paid" as const },
  { label: "Voided", value: "voided" as const },
];

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function HistoryCard({ order, index }: { order: Order; index: number }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/order/[id]", params: { id: order.id } });
  };

  const isPaid = order.status === "paid";
  const statusColor = isPaid ? colors.success : colors.error;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: statusColor + "15" }]}>
          <Feather
            name={isPaid ? "check-circle" : "x-circle"}
            size={22}
            color={statusColor}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.orderNum, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            {order.orderNumber}
          </Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDateTime(order.createdAt)}
          </Text>
          <Text style={[styles.itemsText, { color: colors.textSecondary }]}>
            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
          </Text>
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.total, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            ${order.total.toFixed(2)}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.badgeText, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<"paid" | "voided" | undefined>(undefined);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => api.orders.list(filter),
  });

  const closed = orders?.filter((o) => o.status !== "open") ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <BackButton colors={colors} />
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
          History
        </Text>
        <View style={styles.filters}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.label}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.value);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f.value ? colors.accent : colors.card,
                  borderColor: filter === f.value ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: filter === f.value ? "#fff" : colors.textSecondary,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : closed.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={52} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            No history yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Completed orders will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={closed}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <HistoryCard order={item} index={index} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, letterSpacing: -0.5, marginBottom: 14 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  filterText: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1 },
  orderNum: { fontSize: 15 },
  dateText: { fontSize: 12, marginTop: 3 },
  itemsText: { fontSize: 12, marginTop: 2 },
  rightCol: { alignItems: "flex-end", gap: 6 },
  total: { fontSize: 17 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, letterSpacing: 0.4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
