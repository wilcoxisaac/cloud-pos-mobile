import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import ElavonLogo from "@/components/ElavonLogo";
import { useSettings, type IndustryMode, type TabId } from "@/context/SettingsContext";
import BackButton from "@/components/BackButton";

const BACK_OFFICE_URL = "https://cloud-po-s-wilcoxisaac.replit.app";

type SettingsRowProps = {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: typeof Colors.light;
  hideChevron?: boolean;
};

function SettingsRow({ icon, label, value, onPress, danger, colors, hideChevron }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.divider }]}
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: (danger ? colors.error : colors.accent) + "15" }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.error : colors.accent} />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? colors.error : colors.text, fontFamily: "Inter_500Medium" },
        ]}
      >
        {label}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
      ) : null}
      {onPress && !hideChevron ? (
        <Feather name="chevron-right" size={16} color={colors.textSecondary} />
      ) : null}
    </TouchableOpacity>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: typeof Colors.light }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
      {title}
    </Text>
  );
}

const INDUSTRY_OPTIONS: { value: IndustryMode; label: string; icon: string; description: string }[] = [
  { value: "restaurant", label: "Restaurant", icon: "coffee", description: "Tables, guests, food service" },
  { value: "retail", label: "Retail", icon: "shopping-bag", description: "Products, customers, registers" },
  { value: "service", label: "Service", icon: "briefcase", description: "Clients, stations, appointments" },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { settings, setIndustry, setPaymentTerms, setInvoicePaymentMethods, industryLabel, primaryTabs, availableTabs, setPrimaryTabs } = useSettings();
  const [showIndustryModal, setShowIndustryModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showTabModal, setShowTabModal] = useState(false);
  const [showPayMethodModal, setShowPayMethodModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const PAYMENT_TERMS_OPTIONS = [
    { label: "Due on Receipt", value: "0" },
    { label: "Net 7 (7 days)", value: "7" },
    { label: "Net 15 (15 days)", value: "15" },
    { label: "Net 30 (30 days)", value: "30" },
    { label: "Net 45 (45 days)", value: "45" },
    { label: "Net 60 (60 days)", value: "60" },
  ];

  const currentTermsLabel = PAYMENT_TERMS_OPTIONS.find(
    (o) => o.value === settings.defaultPaymentTerms
  )?.label ?? `Net ${settings.defaultPaymentTerms}`;

  const handleSelectTerms = async (value: string) => {
    if (value === settings.defaultPaymentTerms) { setShowTermsModal(false); return; }
    try {
      await setPaymentTerms(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update payment terms.");
    } finally {
      setShowTermsModal(false);
    }
  };

  const INVOICE_PAYMENT_OPTIONS = [
    { id: "card",   label: "Credit Card",  icon: "credit-card",  description: "Accept credit & debit cards via Elavon" },
    { id: "apple",  label: "Apple Pay",    icon: "smartphone",   description: "Contactless payment for iPhone & Mac" },
    { id: "google", label: "Google Pay",   icon: "globe",        description: "Contactless payment for Android" },
    { id: "paze",   label: "Paze",         icon: "shield",       description: "Bank-linked digital wallet" },
    { id: "affirm", label: "Affirm",       icon: "calendar",     description: "Buy now, pay later financing" },
  ];

  const enabledMethodsLabel = settings.invoicePaymentMethods.length === 0
    ? "None"
    : settings.invoicePaymentMethods
        .map((id) => INVOICE_PAYMENT_OPTIONS.find((o) => o.id === id)?.label ?? id)
        .join(", ");

  const togglePayMethod = async (id: string) => {
    Haptics.selectionAsync();
    const current = settings.invoicePaymentMethods;
    const next = current.includes(id)
      ? current.filter((m) => m !== id)
      : [...current, id];
    try {
      await setInvoicePaymentMethods(next.length > 0 ? next : ["card"]);
    } catch {
      Alert.alert("Error", "Could not update payment methods.");
    }
  };

  const openBackOffice = () => {
    Linking.openURL(BACK_OFFICE_URL).catch(() =>
      Alert.alert("Error", "Could not open back office")
    );
  };

  const handleSelectIndustry = async (industry: IndustryMode) => {
    if (industry === settings.industry) {
      setShowIndustryModal(false);
      return;
    }
    setSaving(true);
    try {
      await setIndustry(industry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update industry setting.");
    } finally {
      setSaving(false);
      setShowIndustryModal(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <BackButton colors={colors} />
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <View style={[styles.brandCard, { backgroundColor: colors.primary }]}>
            <ElavonLogo width={140} height={26} color="#FFFFFF" />
            <Text style={styles.brandSub}>Cloud POS · v1.0.0</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <SectionHeader title="BACK OFFICE" colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="external-link"
              label="Open Back Office"
              onPress={openBackOffice}
              colors={colors}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(130).springify()}>
          <SectionHeader title="INDUSTRY" colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="layers"
              label="Industry Mode"
              value={industryLabel}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowIndustryModal(true);
              }}
              colors={colors}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Changing industry mode updates terminology throughout the app and synchronizes with the back office.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <SectionHeader title="TAB BAR" colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="layout"
              label="Customize Tabs"
              value={`${primaryTabs.length} shown`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTabModal(true);
              }}
              colors={colors}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Choose which tabs appear in the bottom bar. Extra tabs are always available via More.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <SectionHeader title="CONFIGURATION" colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="percent"
              label="Tax Rate"
              value={`${settings.taxRate}%`}
              colors={colors}
            />
            <SettingsRow
              icon="clock"
              label="Default Invoice Terms"
              value={currentTermsLabel}
              onPress={() => setShowTermsModal(true)}
              colors={colors}
            />
            <SettingsRow
              icon="credit-card"
              label="Invoice Payment Methods"
              value={enabledMethodsLabel}
              onPress={() => setShowPayMethodModal(true)}
              colors={colors}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <SectionHeader title="ABOUT" colors={colors} />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="info"
              label="Version"
              value="1.0.0"
              colors={colors}
            />
            <SettingsRow
              icon="shield"
              label="Powered by Elavon"
              colors={colors}
            />
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showIndustryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIndustryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowIndustryModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Select Industry
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              This updates how the app and back office label orders, customers, and locations.
            </Text>

            {INDUSTRY_OPTIONS.map((opt) => {
              const isSelected = settings.industry === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.industryOption,
                    {
                      backgroundColor: isSelected ? colors.accent + "12" : colors.background,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectIndustry(opt.value)}
                  disabled={saving}
                  activeOpacity={0.75}
                >
                  <View style={[styles.industryIcon, { backgroundColor: isSelected ? colors.accent : colors.accent + "15" }]}>
                    <Feather name={opt.icon as any} size={20} color={isSelected ? "#fff" : colors.accent} />
                  </View>
                  <View style={styles.industryText}>
                    <Text style={[styles.industryLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.industryDesc, { color: colors.textSecondary }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather name="check-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowIndustryModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTermsModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Default Invoice Terms
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              How many days after issue date invoices are due by default.
            </Text>

            {PAYMENT_TERMS_OPTIONS.map((opt) => {
              const isSelected = settings.defaultPaymentTerms === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.industryOption,
                    {
                      backgroundColor: isSelected ? colors.accent + "12" : colors.background,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectTerms(opt.value)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.industryIcon, { backgroundColor: isSelected ? colors.accent : colors.accent + "15" }]}>
                    <Feather name="clock" size={18} color={isSelected ? "#fff" : colors.accent} />
                  </View>
                  <Text style={[styles.industryLabel, { color: colors.text, fontFamily: "Inter_600SemiBold", flex: 1 }]}>
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Feather name="check-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showPayMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayMethodModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPayMethodModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Invoice Payment Methods
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Choose which payment options appear on the customer-facing invoice payment page.
            </Text>

            {INVOICE_PAYMENT_OPTIONS.map((opt) => {
              const isActive = settings.invoicePaymentMethods.includes(opt.id);
              const isLast = opt.id === "card" && settings.invoicePaymentMethods.length === 1 && isActive;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.industryOption,
                    {
                      backgroundColor: isActive ? colors.accent + "12" : colors.background,
                      borderColor: isActive ? colors.accent : colors.border,
                      opacity: isLast ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => { if (!isLast) togglePayMethod(opt.id); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.industryIcon, { backgroundColor: isActive ? colors.accent : colors.accent + "15" }]}>
                    <Feather name={opt.icon as any} size={18} color={isActive ? "#fff" : colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.industryLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.industryDesc, { color: colors.textSecondary }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {isActive && (
                    <Feather name="check-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 8, marginBottom: 0 }]}>
              Credit Card cannot be removed as it is the default fallback.
            </Text>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowPayMethodModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTabModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTabModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTabModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Tab Bar
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Select up to 4 tabs for your bottom bar. Others are in More.
            </Text>

            {availableTabs.map((tabId) => {
              const TAB_META: Record<string, { label: string; icon: string }> = {
                index:        { label: "Orders",          icon: "shopping-cart" },
                tables:       { label: "Tables",          icon: "grid" },
                kitchen:      { label: "Kitchen",         icon: "zap" },
                appointments: { label: "Appointments",    icon: "calendar" },
                menu:         { label: industryLabel === "Retail" ? "Catalog" : industryLabel === "Service" ? "Services" : "Menu", icon: "layers" },
                invoices:     { label: "Invoices",        icon: "file-text" },
                customers:    { label: "Customers",       icon: "users" },
                history:      { label: "History",         icon: "clock" },
                backoffice:   { label: "Back Office",     icon: "bar-chart-2" },
                settings:     { label: "Settings",        icon: "settings" },
              };
              const meta = TAB_META[tabId];
              if (!meta) return null;
              const isActive = primaryTabs.includes(tabId as TabId);
              const atMax = primaryTabs.length >= 4 && !isActive;
              return (
                <TouchableOpacity
                  key={tabId}
                  style={[
                    styles.industryOption,
                    {
                      backgroundColor: isActive ? colors.accent + "12" : colors.background,
                      borderColor: isActive ? colors.accent : colors.border,
                      opacity: atMax ? 0.4 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (atMax) return;
                    Haptics.selectionAsync();
                    const next = isActive
                      ? primaryTabs.filter((t) => t !== tabId)
                      : [...primaryTabs, tabId as TabId];
                    setPrimaryTabs(next);
                  }}
                  disabled={atMax}
                  activeOpacity={0.75}
                >
                  <View style={[styles.industryIcon, { backgroundColor: isActive ? colors.accent : colors.accent + "15" }]}>
                    <Feather name={meta.icon as any} size={18} color={isActive ? "#fff" : colors.accent} />
                  </View>
                  <Text style={[styles.industryLabel, { color: colors.text, fontFamily: "Inter_600SemiBold", flex: 1 }]}>
                    {meta.label}
                  </Text>
                  {isActive && (
                    <Feather name="check-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowTabModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  brandCard: {
    alignItems: "flex-start",
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    gap: 12,
  },
  brandSub: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    marginTop: -16,
    marginBottom: 24,
    marginLeft: 4,
    lineHeight: 17,
  },
  section: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 24,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15 },
  rowValue: { fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 20 },
  modalSub: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  industryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  industryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  industryText: { flex: 1 },
  industryLabel: { fontSize: 16 },
  industryDesc: { fontSize: 13, marginTop: 2 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  cancelText: { fontSize: 15 },
});
