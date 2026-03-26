import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { useSettings, type TabId } from "@/context/SettingsContext";
import { useOffline } from "@/context/OfflineContext";

const isIOS = Platform.OS === "ios";

interface NavItem {
  route: string;
  label: string;
  sub: string;
  sfIcon?: string;
  featherIcon?: string;
  ionIcon?: string;
  mcIcon?: string;
  color: string;
}

function NavRow({
  item,
  colors,
  delay,
}: {
  item: NavItem;
  colors: typeof Colors.light;
  delay: number;
}) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(item.route as any);
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={[styles.iconWrap, { backgroundColor: item.color + "18" }]}>
          {isIOS && item.sfIcon ? (
            <SymbolView name={item.sfIcon as any} tintColor={item.color} size={22} />
          ) : item.featherIcon ? (
            <Feather name={item.featherIcon as any} size={22} color={item.color} />
          ) : item.ionIcon ? (
            <Ionicons name={item.ionIcon as any} size={22} color={item.color} />
          ) : item.mcIcon ? (
            <MaterialCommunityIcons name={item.mcIcon as any} size={22} color={item.color} />
          ) : null}
        </View>
        <View style={styles.navText}>
          <Text style={[styles.navLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            {item.label}
          </Text>
          <Text style={[styles.navSub, { color: colors.textSecondary }]}>
            {item.sub}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { industry, hiddenTabs } = useSettings();
  const { isOnline, queuedCount } = useOffline();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const ALL_ITEMS: NavItem[] = [
    {
      route: "/(tabs)",
      label: "Orders",
      sub: "Open & active orders",
      sfIcon: "cart.fill",
      featherIcon: "shopping-cart",
      color: "#0072C4",
    },
    {
      route: "/(tabs)/tables",
      label: "Tables",
      sub: "Floor plan & seating",
      sfIcon: "rectangle.grid.2x2.fill",
      mcIcon: "table-chair",
      color: "#7C3AED",
    },
    {
      route: "/(tabs)/kitchen",
      label: "Kitchen Display",
      sub: "Live ticket queue",
      sfIcon: "flame.fill",
      ionIcon: "flame-outline",
      color: "#EF4444",
    },
    {
      route: "/(tabs)/appointments",
      label: "Appointments",
      sub: "Schedule & bookings",
      sfIcon: "calendar.fill",
      ionIcon: "calendar-outline",
      color: "#10B981",
    },
    {
      route: "/(tabs)/menu",
      label: industry === "retail" ? "Catalog" : industry === "service" ? "Services" : "Menu",
      sub: industry === "retail" ? "Products & pricing" : industry === "service" ? "Services & rates" : "Items & categories",
      sfIcon: industry === "retail" ? "storefront.fill" : industry === "service" ? "list.clipboard.fill" : "fork.knife",
      featherIcon: industry === "retail" ? "shopping-bag" : industry === "service" ? "clipboard" : "grid",
      color: "#F59E0B",
    },
    {
      route: "/(tabs)/invoices",
      label: "Invoices & Quotes",
      sub: "Billing & estimates",
      sfIcon: "doc.text.fill",
      featherIcon: "file-text",
      color: "#3B82F6",
    },
    {
      route: "/(tabs)/customers",
      label: "Customers",
      sub: "CRM & loyalty",
      sfIcon: "person.2.fill",
      ionIcon: "people-outline",
      color: "#8B5CF6",
    },
    {
      route: "/(tabs)/history",
      label: "History",
      sub: "Past transactions",
      sfIcon: "clock.fill",
      featherIcon: "clock",
      color: "#6B7280",
    },
    {
      route: "/(tabs)/backoffice",
      label: "Back Office",
      sub: "Analytics & reports",
      sfIcon: "building.2.fill",
      featherIcon: "bar-chart-2",
      color: "#0C2074",
    },
    {
      route: "/(tabs)/settings",
      label: "Settings",
      sub: "App configuration",
      sfIcon: "gearshape.fill",
      featherIcon: "settings",
      color: "#6B7280",
    },
  ];

  const industryFilter = (item: NavItem): boolean => {
    if (item.route === "/(tabs)/tables" && industry !== "restaurant") return false;
    if (item.route === "/(tabs)/kitchen" && industry !== "restaurant") return false;
    if (item.route === "/(tabs)/appointments" && industry !== "service") return false;
    if (item.route === "/(tabs)/invoices" && industry === "retail") return false;
    return true;
  };

  const items = ALL_ITEMS.filter(industryFilter).filter((item) => {
    const tabId = (item.route.replace("/(tabs)/", "") || "index") as TabId;
    return hiddenTabs.includes(tabId);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            More
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            All features
          </Text>
        </View>
        {(!isOnline || queuedCount > 0) && (
          <View style={[
            styles.offlineBadge,
            { backgroundColor: isOnline ? colors.warning + "20" : colors.error + "20" }
          ]}>
            <View style={[styles.offlineDot, { backgroundColor: isOnline ? colors.warning : colors.error }]} />
            <Text style={[styles.offlineText, { color: isOnline ? colors.warning : colors.error, fontFamily: "Inter_600SemiBold" }]}>
              {isOnline ? `${queuedCount} pending` : "Offline"}
            </Text>
          </View>
        )}
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, i) => (
          <NavRow key={item.route} item={item} colors={colors} delay={i * 40} />
        ))}

        {items.length === 0 && (
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
              All tabs visible
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Customize your tab bar in Settings to move items here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, marginTop: 2 },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  offlineDot: { width: 7, height: 7, borderRadius: 4 },
  offlineText: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navText: { flex: 1 },
  navLabel: { fontSize: 16 },
  navSub: { fontSize: 13, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
