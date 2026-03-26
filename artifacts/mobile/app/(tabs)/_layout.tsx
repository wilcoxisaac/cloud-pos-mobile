import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Colors from "@/constants/colors";
import { useSettings, type TabId } from "@/context/SettingsContext";

function NativeTabLayout() {
  const { industry } = useSettings();
  const menuLabel = industry === "retail" ? "Catalog" : industry === "service" ? "Services" : "Menu";

  // Register ALL industry-relevant tabs — iOS 26's native tab bar handles
  // overflow automatically with its built-in "..." mechanism.
  const triggers: React.ReactElement[] = [];

  triggers.push(
    <NativeTabs.Trigger key="index" name="index">
      <Icon sf={{ default: "cart", selected: "cart.fill" }} />
      <Label>Orders</Label>
    </NativeTabs.Trigger>
  );
  if (industry === "restaurant")
    triggers.push(
      <NativeTabs.Trigger key="tables" name="tables">
        <Icon sf={{ default: "rectangle.grid.2x2", selected: "rectangle.grid.2x2.fill" }} />
        <Label>Tables</Label>
      </NativeTabs.Trigger>
    );
  if (industry === "restaurant")
    triggers.push(
      <NativeTabs.Trigger key="kitchen" name="kitchen">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Kitchen</Label>
      </NativeTabs.Trigger>
    );
  if (industry === "service")
    triggers.push(
      <NativeTabs.Trigger key="appointments" name="appointments">
        <Icon sf={{ default: "calendar", selected: "calendar.fill" }} />
        <Label>Appts</Label>
      </NativeTabs.Trigger>
    );
  triggers.push(
    <NativeTabs.Trigger key="menu" name="menu">
      <Icon
        sf={
          industry === "retail"
            ? { default: "storefront", selected: "storefront.fill" }
            : industry === "service"
            ? { default: "list.clipboard", selected: "list.clipboard.fill" }
            : { default: "fork.knife", selected: "fork.knife" }
        }
      />
      <Label>{menuLabel}</Label>
    </NativeTabs.Trigger>
  );
  if (industry !== "retail")
    triggers.push(
      <NativeTabs.Trigger key="invoices" name="invoices">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Invoices</Label>
      </NativeTabs.Trigger>
    );
  triggers.push(
    <NativeTabs.Trigger key="customers" name="customers">
      <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
      <Label>Customers</Label>
    </NativeTabs.Trigger>
  );
  triggers.push(
    <NativeTabs.Trigger key="history" name="history">
      <Icon sf={{ default: "clock", selected: "clock.fill" }} />
      <Label>History</Label>
    </NativeTabs.Trigger>
  );
  triggers.push(
    <NativeTabs.Trigger key="backoffice" name="backoffice">
      <Icon sf={{ default: "building.2", selected: "building.2.fill" }} />
      <Label>Back Office</Label>
    </NativeTabs.Trigger>
  );
  triggers.push(
    <NativeTabs.Trigger key="settings" name="settings">
      <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      <Label>Settings</Label>
    </NativeTabs.Trigger>
  );

  return <NativeTabs>{triggers}</NativeTabs>;
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { primaryTabs } = useSettings();

  const visibleRoutes = state.routes.filter(
    (r) => primaryTabs.includes(r.name as TabId) || r.name === "more"
  );

  const isMoreActive =
    !primaryTabs.includes(state.routes[state.index]?.name as TabId);

  return (
    <View
      style={[
        tabStyles.bar,
        {
          paddingBottom: insets.bottom || (isWeb ? 8 : 4),
          borderTopWidth: isDark ? 0 : 0.5,
          borderTopColor: colors.border,
          backgroundColor: isIOS ? "transparent" : colors.backgroundSecondary,
          ...(isWeb ? { height: 84 } : {}),
        },
      ]}
    >
      {isIOS && (
        <BlurView
          intensity={100}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}

      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const globalIndex = state.routes.indexOf(route);
        const isCurrentTab = globalIndex === state.index;
        const isMoreTab = route.name === "more";
        const isFocused = isMoreTab ? isMoreActive : isCurrentTab;
        const color = isFocused ? colors.accent : colors.tabIconDefault;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, undefined);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={tabStyles.button}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
            <Text
              style={[
                tabStyles.label,
                { color, fontFamily: isFocused ? "Inter_600SemiBold" : "Inter_400Regular" },
              ]}
              numberOfLines={1}
            >
              {options.title ?? route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    elevation: 0,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const colors = isDark ? Colors.dark : Colors.light;
  const { industry } = useSettings();
  const menuLabel = industry === "retail" ? "Catalog" : industry === "service" ? "Services" : "Menu";

  return (
    <Tabs
      tabBar={CustomTabBar}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabIconDefault,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="cart.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="receipt-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: "Tables",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="rectangle.grid.2x2.fill" tintColor={color} size={size} />
            ) : (
              <MaterialCommunityIcons name="table-chair" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: "Kitchen",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="flame.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="flame-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appts",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="calendar.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: menuLabel,
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView
                name={
                  industry === "retail"
                    ? "storefront.fill"
                    : industry === "service"
                    ? "list.clipboard.fill"
                    : "fork.knife"
                }
                tintColor={color}
                size={size}
              />
            ) : (
              <Feather
                name={
                  industry === "retail"
                    ? "shopping-bag"
                    : industry === "service"
                    ? "clipboard"
                    : "grid"
                }
                size={size}
                color={color}
              />
            ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="doc.text.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="file-text" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="person.2.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="clock.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="clock" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="backoffice"
        options={{
          title: "Back Office",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="building.2.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="bar-chart-2" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="gearshape.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="settings" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="more-horizontal" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{ href: null }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
