import { router } from "expo-router";
import { Platform, TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";

type Props = {
  colors: { accent: string };
  label?: string;
  style?: ViewStyle;
};

export default function BackButton({ colors, label = "Back", style }: Props) {
  if (!router.canGoBack()) return null;

  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={[styles.btn, style]}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 20 }}
      accessibilityRole="button"
      accessibilityLabel={`Go back`}
    >
      {Platform.OS === "ios" ? (
        <SymbolView name="chevron.left" tintColor={colors.accent} size={17} />
      ) : (
        <Feather name="chevron-left" size={20} color={colors.accent} />
      )}
      <Text
        style={[styles.label, { color: colors.accent, fontFamily: "Inter_500Medium" }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 16,
  },
});
