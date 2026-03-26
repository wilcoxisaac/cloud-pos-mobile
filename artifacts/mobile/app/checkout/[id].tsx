import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { api, type CustomerSummary } from "@/lib/api";
import { TapToPayModal } from "@/components/TapToPayModal";
import { useTapToPay } from "@/hooks/useTapToPay";
import type { PaymentResult } from "@/types/pos";

type PaymentMethod = "cash" | "card";
type ReceiptMethod = "email" | "sms";
type Phase = "checkout" | "receipt_choice" | "receipt_contact" | "success";

type LoyaltyOutcome = {
  isNew: boolean;
  pointsEarned: number;
  customer: { id: number; name: string; loyaltyPoints: number; tier: string; tierColor: string };
};

type ReceiptOutcome = { sent: boolean; method: ReceiptMethod | null; loyalty: LoyaltyOutcome | null };

function PaymentMethodButton({
  label, icon, selected, onSelect, colors, isLast,
}: {
  label: string; icon: string; selected: boolean; onSelect: () => void; colors: typeof Colors.light; isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.methodBtn,
        { backgroundColor: selected ? colors.accent : colors.card, borderColor: selected ? colors.accent : colors.border },
        isLast && styles.methodBtnLast,
      ]}
      onPress={() => { Haptics.selectionAsync(); onSelect(); }}
      activeOpacity={0.8}
    >
      <Feather name={icon as any} size={24} color={selected ? "#fff" : colors.text} />
      <Text style={[styles.methodLabel, { color: selected ? "#fff" : colors.text, fontFamily: "Inter_600SemiBold" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ReceiptChoiceStep({
  result, wasContactless, colors, insets, onChoice,
}: {
  result: PaymentResult;
  wasContactless: boolean;
  colors: typeof Colors.light;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onChoice: (method: ReceiptMethod | null) => void;
}) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const methodLabel = wasContactless ? "Contactless" : result.order.paymentMethod === "cash" ? "Cash" : "Card";
  const isChange = result.order.paymentMethod === "cash" && result.changeDue != null && result.changeDue > 0;

  return (
    <View style={[styles.receiptChoiceContainer, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: insets.bottom + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.receiptChoiceScroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.receiptChoiceInner}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + "20", alignSelf: "center" }]}>
            <Feather name="check-circle" size={52} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
            Payment Complete!
          </Text>
          <Text style={[styles.successOrder, { color: colors.textSecondary, textAlign: "center" }]}>
            {result.order.orderNumber}
          </Text>

          <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Total Charged</Text>
              <Text style={[styles.receiptValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                ${result.order.total.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.receiptRow, { borderBottomWidth: isChange ? 0.5 : 0 }]}>
              <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Payment</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {wasContactless && (
                  <Feather name="wifi" size={13} color={colors.accent} style={{ transform: [{ rotate: "90deg" }], marginRight: 6 }} />
                )}
                <Text style={[styles.receiptValue, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                  {methodLabel}
                </Text>
              </View>
            </View>
            {isChange && (
              <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.receiptLabel, { color: colors.success, fontFamily: "Inter_700Bold" }]}>Change Due</Text>
                <Text style={{ color: colors.success, fontSize: 18, fontFamily: "Inter_700Bold" }}>
                  ${result.changeDue!.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.receiptPrompt, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
            SEND RECEIPT TO
          </Text>

          <TouchableOpacity
            style={[styles.receiptOptionBtn, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChoice("email"); }}
            activeOpacity={0.8}
          >
            <View style={[styles.receiptOptionIcon, { backgroundColor: colors.accent + "15" }]}>
              <Feather name="mail" size={20} color={colors.accent} />
            </View>
            <View style={styles.receiptOptionText}>
              <Text style={[styles.receiptOptionLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Email Receipt</Text>
              <Text style={[styles.receiptOptionSub, { color: colors.textSecondary }]}>Send to email address</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.receiptOptionBtn, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChoice("sms"); }}
            activeOpacity={0.8}
          >
            <View style={[styles.receiptOptionIcon, { backgroundColor: colors.accent + "15" }]}>
              <Feather name="message-square" size={20} color={colors.accent} />
            </View>
            <View style={styles.receiptOptionText}>
              <Text style={[styles.receiptOptionLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Text Message</Text>
              <Text style={[styles.receiptOptionSub, { color: colors.textSecondary }]}>Send to phone number</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.receiptOptionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChoice(null); }}
            activeOpacity={0.8}
          >
            <View style={[styles.receiptOptionIcon, { backgroundColor: colors.textSecondary + "18" }]}>
              <Feather name="x-circle" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.receiptOptionText}>
              <Text style={[styles.receiptOptionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>No Receipt</Text>
              <Text style={[styles.receiptOptionSub, { color: colors.textSecondary }]}>Skip and finish</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ReceiptContactStep({
  result, method, colors, insets, onComplete,
}: {
  result: PaymentResult;
  method: ReceiptMethod;
  colors: typeof Colors.light;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onComplete: (outcome: ReceiptOutcome) => void;
}) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [subStep, setSubStep] = useState<"search" | "form">("search");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [enrollLoyalty, setEnrollLoyalty] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const contactRef = useRef<TextInput>(null);

  const isEmail = method === "email";
  const contactLabel = isEmail ? "Email address" : "Phone number";
  const contactKeyboard = isEmail ? "email-address" : "phone-pad";

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.phone?.includes(q))
    );
  }, [customers, search]);

  const selectCustomer = (c: CustomerSummary) => {
    setSelectedCustomer(c);
    setName(c.name);
    setContact(isEmail ? (c.email ?? "") : (c.phone ?? ""));
    setEnrollLoyalty(true);
    setSubStep("form");
    Haptics.selectionAsync();
  };

  const enterManually = () => {
    setSelectedCustomer(null);
    setName("");
    setContact("");
    setEnrollLoyalty(null);
    setSubStep("form");
    Haptics.selectionAsync();
  };

  const canSend =
    name.trim().length > 0 &&
    contact.trim().length > 0 &&
    (selectedCustomer !== null || enrollLoyalty !== null);

  const handleSend = async () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      const res = await api.orders.receipt(result.order.id, {
        method,
        name: name.trim(),
        contact: contact.trim(),
        enrollLoyalty: enrollLoyalty ?? true,
      });
      onComplete({ sent: res.sent, method, loyalty: res.loyalty });
    } catch {
      Alert.alert("Error", "Could not process receipt. Continuing without sending.");
      onComplete({ sent: false, method, loyalty: null });
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    onComplete({ sent: false, method: null, loyalty: null });
  };

  const headerRow = (onBack: () => void, title: string) => (
    <Animated.View
      entering={FadeInUp.springify()}
      style={[styles.contactHeader, { paddingTop: topPad + 12, paddingBottom: 16 }]}
    >
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{title}</Text>
      <View style={{ width: 40 }} />
    </Animated.View>
  );

  // ── Search sub-step ──────────────────────────────────────────
  if (subStep === "search") {
    return (
      <View style={[styles.receiptChoiceContainer, { backgroundColor: colors.background }]}>
        {headerRow(handleSkip, isEmail ? "Email Receipt" : "Text Receipt")}

        <Animated.View entering={FadeInDown.delay(40).springify()} style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={[styles.inputField, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.inputText, { color: colors.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Search by name, email, or phone…"
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {customersLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
          ) : filtered.length === 0 && search.trim() ? (
            <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 32, fontFamily: "Inter_400Regular", fontSize: 14 }}>
              No customers found for "{search}"
            </Text>
          ) : (
            filtered.map((c) => {
              const contactVal = isEmail ? c.email : c.phone;
              const hasContact = !!contactVal;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.customerRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: hasContact ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => hasContact && selectCustomer(c)}
                  activeOpacity={hasContact ? 0.75 : 1}
                  disabled={!hasContact}
                >
                  <View style={[styles.customerAvatar, { backgroundColor: colors.accent + "20" }]}>
                    <Text style={{ color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {contactVal ?? (isEmail ? "No email on file" : "No phone on file")}
                    </Text>
                  </View>
                  {c.loyaltyPoints > 0 && (
                    <View style={[styles.tierBadge, { backgroundColor: c.tierBg ?? colors.accent + "20" }]}>
                      <Text style={{ color: c.tierColor ?? colors.accent, fontSize: 10, fontFamily: "Inter_700Bold" }}>
                        {c.tier}
                      </Text>
                    </View>
                  )}
                  {hasContact && (
                    <Feather name="chevron-right" size={16} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={[
              styles.newCustomerBtn,
              { borderColor: colors.accent, backgroundColor: colors.accent + "10", marginTop: filtered.length > 0 || (search.trim() && filtered.length === 0) ? 16 : 0 },
            ]}
            onPress={enterManually}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={18} color={colors.accent} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              New Customer
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Form sub-step ────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.receiptChoiceContainer, { backgroundColor: colors.background }]}>
        {headerRow(() => setSubStep("search"), isEmail ? "Email Receipt" : "Text Receipt")}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {selectedCustomer && (
            <Animated.View
              entering={FadeInDown.delay(30).springify()}
              style={[styles.selectedCustomerBanner, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "40" }]}
            >
              <Feather name="user-check" size={15} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>
                {selectedCustomer.name}
                {selectedCustomer.loyaltyPoints > 0
                  ? `  ·  ${selectedCustomer.loyaltyPoints} pts`
                  : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setSubStep("search")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: colors.accent, fontFamily: "Inter_500Medium", fontSize: 12 }}>Change</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>
              RECIPIENT
            </Text>
            <View style={[styles.inputField, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.inputText, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Full name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => contactRef.current?.focus()}
              />
            </View>

            <View style={[styles.inputField, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
              <Feather name={isEmail ? "mail" : "smartphone"} size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                ref={contactRef}
                style={[styles.inputText, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder={contactLabel}
                placeholderTextColor={colors.textSecondary}
                value={contact}
                onChangeText={setContact}
                keyboardType={contactKeyboard as any}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </Animated.View>

          {selectedCustomer ? (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <View style={[styles.loyaltyCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
                <View style={[styles.loyaltyIconWrap, { backgroundColor: "#F59E0B20", marginRight: 14 }]}>
                  <Feather name="star" size={22} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                  <Text style={[styles.loyaltyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                    +{Math.floor(result.order.total)} Points
                  </Text>
                  <Text style={[styles.loyaltySub, { color: colors.textSecondary }]}>
                    {selectedCustomer.loyaltyPoints > 0
                      ? `Will be added to existing ${selectedCustomer.loyaltyPoints} pts`
                      : "Will be added to their loyalty account"}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold", marginTop: 24 }]}>
                LOYALTY PROGRAM
              </Text>
              <View style={[styles.loyaltyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.loyaltyIconWrap, { backgroundColor: "#F59E0B20", marginRight: 14 }]}>
                  <Feather name="star" size={22} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                  <Text style={[styles.loyaltyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                    Earn {Math.floor(result.order.total)} Points
                  </Text>
                  <Text style={[styles.loyaltySub, { color: colors.textSecondary }]}>
                    Would you like to join our loyalty program?
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", marginTop: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.loyaltyBtn,
                    { borderColor: enrollLoyalty === true ? "#16a34a" : colors.border, backgroundColor: enrollLoyalty === true ? "#16a34a10" : colors.card, marginRight: 10 },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setEnrollLoyalty(true); }}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={16} color={enrollLoyalty === true ? "#16a34a" : colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.loyaltyBtnText, { color: enrollLoyalty === true ? "#16a34a" : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                    Yes, Enroll
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.loyaltyBtn,
                    { borderColor: enrollLoyalty === false ? colors.accent : colors.border, backgroundColor: enrollLoyalty === false ? colors.accent + "10" : colors.card },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setEnrollLoyalty(false); }}
                  activeOpacity={0.8}
                >
                  <Feather name="x" size={16} color={enrollLoyalty === false ? colors.accent : colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.loyaltyBtnText, { color: enrollLoyalty === false ? colors.accent : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                    No Thanks
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 16 : 8) }]}>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: canSend ? colors.accent : colors.border, opacity: sending ? 0.7 : 1 }]}
            onPress={handleSend}
            disabled={!canSend || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name={isEmail ? "send" : "message-square"} size={18} color="#fff" />
                <Text style={[styles.payBtnText, { fontFamily: "Inter_700Bold" }]}>
                  {isEmail ? "Send Email Receipt" : "Send Text Receipt"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium", fontSize: 14 }}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SuccessScreen({
  result, wasContactless, receiptOutcome, colors, insets,
}: {
  result: PaymentResult;
  wasContactless: boolean;
  receiptOutcome: ReceiptOutcome | null;
  colors: typeof Colors.light;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isChange = result.order.paymentMethod === "cash" && result.changeDue != null && result.changeDue > 0;
  const methodLabel = wasContactless ? "Contactless" : result.order.paymentMethod === "cash" ? "Cash" : "Card";
  const loyalty = receiptOutcome?.loyalty ?? null;

  return (
    <View style={[styles.receiptChoiceContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.receiptChoiceScroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
      <Animated.View entering={FadeInDown.springify()} style={styles.receiptChoiceInner}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + "20", alignSelf: "center" }]}>
          <Feather name="check-circle" size={52} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
          Payment Complete!
        </Text>
        <Text style={[styles.successOrder, { color: colors.textSecondary, textAlign: "center" }]}>
          {result.order.orderNumber}
        </Text>

        <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Total Charged</Text>
            <Text style={[styles.receiptValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              ${result.order.total.toFixed(2)}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Payment Method</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {wasContactless && (
                <Feather name="wifi" size={13} color={colors.accent} style={{ transform: [{ rotate: "90deg" }], marginRight: 6 }} />
              )}
              <Text style={[styles.receiptValue, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                {methodLabel}
              </Text>
            </View>
          </View>
          {result.order.amountTendered != null && !wasContactless && (
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Tendered</Text>
              <Text style={[styles.receiptValue, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                ${result.order.amountTendered.toFixed(2)}
              </Text>
            </View>
          )}
          {isChange && (
            <View style={[styles.receiptRow, styles.changeRow]}>
              <Text style={[styles.receiptLabel, { color: colors.success, fontFamily: "Inter_700Bold" }]}>Change Due</Text>
              <Text style={[styles.changeValue, { color: colors.success, fontFamily: "Inter_700Bold" }]}>
                ${result.changeDue!.toFixed(2)}
              </Text>
            </View>
          )}
          {receiptOutcome?.method && (
            <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Receipt</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name={receiptOutcome.sent ? "check" : "clock"}
                  size={13}
                  color={receiptOutcome.sent ? colors.success : colors.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.receiptValue, { color: receiptOutcome.sent ? colors.success : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                  {receiptOutcome.sent
                    ? receiptOutcome.method === "email" ? "Email sent" : "Text sent"
                    : receiptOutcome.method === "email" ? "Email queued" : "Text queued"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {loyalty && (
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={[styles.loyaltyResultCard, {
              backgroundColor: loyalty.isNew ? "#16a34a10" : colors.accent + "10",
              borderColor: loyalty.isNew ? "#16a34a40" : colors.accent + "40",
            }]}
          >
            <Feather name="star" size={18} color={loyalty.isNew ? "#16a34a" : colors.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
              <Text style={[styles.loyaltyResultTitle, { color: loyalty.isNew ? "#16a34a" : colors.accent, fontFamily: "Inter_700Bold" }]}>
                {loyalty.isNew ? "New customer enrolled!" : `Welcome back, ${loyalty.customer.name.split(" ")[0]}!`}
              </Text>
              <Text style={[styles.loyaltyResultSub, { color: colors.textSecondary }]}>
                {`+${loyalty.pointsEarned} pts earned · ${loyalty.customer.loyaltyPoints} total · ${loyalty.customer.tier}`}
              </Text>
              {!loyalty.isNew && (
                <Text style={[{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 }]}>
                  Transaction recorded for existing customer.
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: colors.accent }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace("/(tabs)");
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.doneBtnText, { fontFamily: "Inter_700Bold" }]}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
      </ScrollView>
    </View>
  );
}

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = parseInt(id ?? "0");
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<PaymentMethod>("card");
  const [cashAmount, setCashAmount] = useState("");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [phase, setPhase] = useState<Phase>("checkout");
  const [receiptMethod, setReceiptMethod] = useState<ReceiptMethod>("email");
  const [receiptOutcome, setReceiptOutcome] = useState<ReceiptOutcome | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const wasContactlessRef = useRef(false);

  const tapToPay = useTapToPay();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.orders.get(orderId),
    enabled: !!orderId,
  });

  const payMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.orders.pay>[1]) => api.orders.pay(orderId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(["order", orderId], result.order);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPaymentResult(result);
      setPhase("receipt_choice");
    },
    onError: (err) => {
      tapToPay.reset();
      Alert.alert("Payment Failed", err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const submitPayment = (contactless: boolean, tendered?: number) => {
    wasContactlessRef.current = contactless;
    payMutation.mutate({ method: "card", amountTendered: tendered ?? null });
  };

  const handlePay = async () => {
    if (!order) return;
    if (method === "cash") {
      if (cashAmount) {
        const amount = parseFloat(cashAmount);
        if (isNaN(amount) || amount < order.total) {
          Alert.alert("Insufficient Cash", `Amount must be at least $${order.total.toFixed(2)}`);
          return;
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      wasContactlessRef.current = false;
      payMutation.mutate({ method: "cash", amountTendered: cashAmount ? parseFloat(cashAmount) : null });
      return;
    }
    if (method === "card") {
      if (tapToPay.isNativeNfc) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const approved = await tapToPay.startScan();
        if (approved) {
          submitPayment(true);
        } else if (tapToPay.status === "error") {
          Alert.alert("Card Read Error", "Could not read the card. Please try again or use a different payment method.");
        }
      } else {
        setShowSimModal(true);
      }
    }
  };

  const handleSimApproved = () => { setShowSimModal(false); submitPayment(true); };
  const handleSimCancel = () => setShowSimModal(false);

  const handleReceiptChoice = (chosen: ReceiptMethod | null) => {
    if (chosen === null) {
      setReceiptOutcome(null);
      setPhase("success");
    } else {
      setReceiptMethod(chosen);
      setPhase("receipt_contact");
    }
  };

  const handleReceiptComplete = (outcome: ReceiptOutcome) => {
    setReceiptOutcome(outcome);
    setPhase("success");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (paymentResult && phase === "receipt_choice") {
    return (
      <ReceiptChoiceStep
        result={paymentResult}
        wasContactless={wasContactlessRef.current}
        colors={colors}
        insets={insets}
        onChoice={handleReceiptChoice}
      />
    );
  }

  if (paymentResult && phase === "receipt_contact") {
    return (
      <ReceiptContactStep
        result={paymentResult}
        method={receiptMethod}
        colors={colors}
        insets={insets}
        onComplete={handleReceiptComplete}
      />
    );
  }

  if (paymentResult && phase === "success") {
    return (
      <SuccessScreen
        result={paymentResult}
        wasContactless={wasContactlessRef.current}
        receiptOutcome={receiptOutcome}
        colors={colors}
        insets={insets}
      />
    );
  }

  const change =
    method === "cash" && cashAmount && order
      ? Math.max(0, parseFloat(cashAmount || "0") - order.total)
      : null;

  const isCardScanning = method === "card" && tapToPay.isNativeNfc && tapToPay.status !== "idle" && tapToPay.status !== "cancelled" && tapToPay.status !== "error";
  const isLoading2 = payMutation.isPending || isCardScanning;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View entering={FadeInUp.springify()} style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Checkout</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading || !order ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(60).springify()}>
                <View style={[styles.orderSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.orderNum, { color: colors.textSecondary }]}>{order.orderNumber}</Text>
                  <Text style={[styles.totalAmount, { color: colors.accent, fontFamily: "Inter_700Bold" }]}>
                    ${order.total.toFixed(2)}
                  </Text>
                  <Text style={[styles.taxNote, { color: colors.textSecondary }]}>
                    incl. ${order.tax.toFixed(2)} tax
                  </Text>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                  PAYMENT METHOD
                </Text>
                <View style={styles.methodRow}>
                  <PaymentMethodButton label="Card" icon="credit-card" selected={method === "card"} onSelect={() => { tapToPay.reset(); setMethod("card"); }} colors={colors} />
                  <PaymentMethodButton label="Cash" icon="dollar-sign" selected={method === "cash"} onSelect={() => { tapToPay.reset(); setMethod("cash"); }} colors={colors} isLast />
                </View>

                {method === "card" && (
                  <Animated.View entering={FadeInDown.springify()}>
                    <View style={[styles.contactlessInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Feather name="wifi" size={18} color={colors.accent} style={{ transform: [{ rotate: "90deg" }], marginRight: 12 }} />
                      <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                        <Text style={[styles.contactlessTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Tap to Pay</Text>
                        <Text style={[styles.contactlessSub, { color: colors.textSecondary }]}>
                          {tapToPay.isNativeNfc
                            ? "Hold any contactless card, Apple Pay, or Apple Watch near the top of iPhone"
                            : "Accepts contactless cards, Apple Pay, and Apple Watch"}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>

              {method === "cash" && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>CASH TENDERED</Text>
                  <View style={[styles.cashInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.dollarSign, { color: colors.textSecondary, fontFamily: "Inter_700Bold" }]}>$</Text>
                    <TextInput
                      style={[styles.cashField, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}
                      value={cashAmount}
                      onChangeText={setCashAmount}
                      keyboardType="decimal-pad"
                      placeholder={order.total.toFixed(2)}
                      placeholderTextColor={colors.textSecondary}
                      autoFocus
                    />
                  </View>
                  {change !== null && !isNaN(change) && (
                    <Animated.View entering={FadeInDown.springify()} style={[styles.changeCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
                      <Feather name="refresh-cw" size={16} color={colors.success} />
                      <Text style={[styles.changeLabel, { color: colors.success }]}>Change Due</Text>
                      <Text style={[styles.changeAmount, { color: colors.success, fontFamily: "Inter_700Bold" }]}>${change.toFixed(2)}</Text>
                    </Animated.View>
                  )}
                  <View style={styles.quickCash}>
                    {[Math.ceil(order.total), Math.ceil(order.total / 5) * 5, Math.ceil(order.total / 10) * 10, Math.ceil(order.total / 20) * 20]
                      .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)
                      .map((amount) => (
                        <TouchableOpacity key={amount} style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setCashAmount(amount.toFixed(2)); }}>
                          <Text style={[styles.quickBtnText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>${amount}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>

        {order && !isLoading && (
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 16 : 8) }]}>
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.accent, opacity: isLoading2 ? 0.7 : 1 }]}
              onPress={handlePay}
              disabled={isLoading2}
              activeOpacity={0.85}
            >
              {isLoading2 ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  {method === "card" ? (
                    <Feather name="wifi" size={20} color="#fff" style={{ transform: [{ rotate: "90deg" }] }} />
                  ) : (
                    <Feather name="check" size={20} color="#fff" />
                  )}
                  <Text style={[styles.payBtnText, { fontFamily: "Inter_700Bold" }]}>
                    {method === "card" ? `Charge $${order.total.toFixed(2)}` : "Confirm Cash Payment"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {order && (
        <TapToPayModal
          visible={showSimModal}
          amount={order.total}
          onApproved={handleSimApproved}
          onCancel={handleSimCancel}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  contactHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  orderSummary: { alignItems: "center", borderRadius: 16, borderWidth: 0.5, padding: 28, marginBottom: 24 },
  orderNum: { fontSize: 13, marginBottom: 8, letterSpacing: 0.3 },
  totalAmount: { fontSize: 48, letterSpacing: -1 },
  taxNote: { fontSize: 13, marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  methodRow: { flexDirection: "row", marginBottom: 14 },
  methodBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 20, borderWidth: 1.5, marginRight: 12 },
  methodBtnLast: { marginRight: 0 },
  methodLabel: { fontSize: 15, marginTop: 8 },
  contactlessInfo: { flexDirection: "row", alignItems: "flex-start", borderRadius: 12, borderWidth: 0.5, padding: 14, marginBottom: 8 },
  contactlessTitle: { fontSize: 14, marginBottom: 3 },
  contactlessSub: { fontSize: 12, lineHeight: 17 },
  cashInput: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 14 },
  dollarSign: { fontSize: 28, marginRight: 4 },
  cashField: { flex: 1, fontSize: 36, minHeight: 44 },
  changeCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  changeLabel: { flex: 1, fontSize: 15, marginLeft: 10 },
  changeAmount: { fontSize: 20 },
  quickCash: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  quickBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 0.5, marginRight: 8, marginBottom: 8 },
  quickBtnText: { fontSize: 14 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 12, borderTopWidth: 0.5 },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, shadowColor: "#0072C4", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  payBtnText: { color: "#fff", fontSize: 17, marginLeft: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  receiptChoiceContainer: { flex: 1 },
  receiptChoiceScroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  receiptChoiceInner: { width: "100%" },
  receiptOptionText: { flex: 1, marginLeft: 14 },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 0 },
  successContent: { width: "100%", alignItems: "center", paddingHorizontal: 24 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 28, letterSpacing: -0.5, marginBottom: 6 },
  successOrder: { fontSize: 15, marginBottom: 28 },
  receiptCard: { width: "100%", borderRadius: 16, borderWidth: 0.5, overflow: "hidden", marginBottom: 28 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  changeRow: { borderBottomWidth: 0 },
  receiptLabel: { fontSize: 14 },
  receiptValue: { fontSize: 15 },
  changeValue: { fontSize: 20 },
  doneBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: "#0072C4", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  doneBtnText: { color: "#fff", fontSize: 17 },
  receiptPrompt: { fontSize: 11, letterSpacing: 0.8, marginBottom: 14, marginTop: 4, alignSelf: "flex-start", marginLeft: 4 },
  receiptOptionBtn: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 0.5, padding: 16 },
  receiptOptionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  receiptOptionLabel: { fontSize: 15, marginBottom: 2 },
  receiptOptionSub: { fontSize: 12 },
  inputField: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  inputText: { flex: 1, fontSize: 16 },
  loyaltyCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 0.5, padding: 16 },
  loyaltyIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  loyaltyTitle: { fontSize: 15, marginBottom: 2 },
  loyaltySub: { fontSize: 13 },
  loyaltyBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  loyaltyBtnText: { fontSize: 14 },
  loyaltyResultCard: { width: "100%", flexDirection: "row", alignItems: "flex-start", borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  loyaltyResultTitle: { fontSize: 14, marginBottom: 2 },
  loyaltyResultSub: { fontSize: 13 },
  customerRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 0.5, padding: 12, marginBottom: 10 },
  customerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginLeft: 8 },
  newCustomerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 16 },
  selectedCustomerBanner: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4, marginTop: 4 },
});
