import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TapState = "ready" | "detected" | "processing" | "approved";

const ACCENT = "#0072C4";
const SUCCESS = "#34C759";
const BG = "#0A1628";

function PhoneOutline() {
  return (
    <View style={styles.phoneBody}>
      <View style={styles.phoneNotch} />
      <View style={styles.phoneScreen}>
        <View style={styles.phoneLockIcon}>
          <Feather name="lock" size={18} color="rgba(255,255,255,0.35)" />
        </View>
      </View>
      <View style={styles.phoneNfcZone}>
        <View style={styles.phoneNfcDot} />
      </View>
    </View>
  );
}

function NfcFieldRing({ delay, size }: { delay: number; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withDelay(
        delay,
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) })
      ),
      -1,
      false
    );
  }, [delay, size]);

  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.3, 1]);
    const opacity = interpolate(progress.value, [0, 0.15, 0.8, 1], [0, 0.5, 0.3, 0]);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View
      style={[
        styles.fieldRing,
        { width: size, height: size, borderRadius: size / 2 },
        animStyle,
      ]}
    />
  );
}

function CardApproaching({ fast }: { fast?: boolean }) {
  const cardY = useSharedValue(-60);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 300 });
    if (fast) {
      cardY.value = withTiming(-8, { duration: 500, easing: Easing.out(Easing.cubic) });
    } else {
      cardY.value = withRepeat(
        withSequence(
          withTiming(-60, { duration: 0 }),
          withDelay(600, withTiming(-8, { duration: 900, easing: Easing.out(Easing.cubic) })),
          withTiming(-8, { duration: 400 }),
          withTiming(-60, { duration: 500, easing: Easing.in(Easing.cubic) }),
          withTiming(-60, { duration: 400 })
        ),
        -1,
        false
      );
    }
  }, [fast]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <View style={styles.cardChip} />
      <View style={styles.cardStripe} />
      <View style={styles.cardLogo}>
        <View style={[styles.cardLogoCircle, { backgroundColor: "rgba(255,80,80,0.7)", marginRight: -8 }]} />
        <View style={[styles.cardLogoCircle, { backgroundColor: "rgba(255,160,0,0.7)" }]} />
      </View>
    </Animated.View>
  );
}

export function TapToPayModal({
  visible,
  amount,
  onApproved,
  onCancel,
}: {
  visible: boolean;
  amount: number;
  onApproved: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [tapState, setTapState] = useState<TapState>("ready");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const approvedCalledRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!visible) {
      setTapState("ready");
      approvedCalledRef.current = false;
      clearTimers();
      return;
    }

    approvedCalledRef.current = false;
    setTapState("ready");

    const t1 = setTimeout(() => {
      setTapState("detected");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 900);

    const t2 = setTimeout(() => {
      setTapState("processing");
    }, 1700);

    const t3 = setTimeout(() => {
      setTapState("approved");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2900);

    const t4 = setTimeout(() => {
      if (!approvedCalledRef.current) {
        approvedCalledRef.current = true;
        onApproved();
      }
    }, 4200);

    timersRef.current = [t1, t2, t3, t4];
    return () => clearTimers();
  }, [visible]);

  const isReady = tapState === "ready";
  const isDetected = tapState === "detected";
  const isProcessing = tapState === "processing";
  const isApproved = tapState === "approved";

  const stateLabel = () => {
    if (tapState === "ready") return "Tap to Pay";
    if (tapState === "detected") return "Card detected…";
    if (tapState === "processing") return "Processing payment…";
    return "Payment approved!";
  };

  const stateSubLabel = () => {
    if (tapState === "ready") return "Tap detected — processing your card";
    if (tapState === "detected") return "Reading card";
    if (tapState === "processing") return "Please wait";
    return "Transaction complete";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.body}>
          {isApproved ? (
            <Animated.View entering={FadeIn.springify()} style={styles.approvedBlock}>
              <View style={styles.approvedCircle}>
                <Feather name="check" size={56} color={SUCCESS} />
              </View>
              <Text style={styles.approvedText}>Approved</Text>
              <Text style={styles.approvedAmount}>${amount.toFixed(2)}</Text>
            </Animated.View>
          ) : isProcessing ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.processingBlock}>
              <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 24 }} />
              <Text style={styles.mainLabel}>{stateLabel()}</Text>
              <Text style={styles.subLabel}>{stateSubLabel()}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={styles.readyBlock}>
              <View style={styles.sceneWrapper}>
                <CardApproaching fast={isDetected} />
                <View style={styles.nfcFieldWrapper}>
                  <NfcFieldRing delay={0} size={120} />
                  <NfcFieldRing delay={320} size={170} />
                  <NfcFieldRing delay={640} size={220} />
                </View>
                <PhoneOutline />
              </View>
            </Animated.View>
          )}
        </View>

        {!isApproved && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
            <View style={[styles.amountBadge, { borderColor: isProcessing ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)" }]}>
              <Text style={styles.amountLabel}>Total</Text>
              <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
            </View>

            <Text style={styles.mainLabel}>{stateLabel()}</Text>
            <Text style={styles.subLabel}>{stateSubLabel()}</Text>

            {isReady && (
              <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.chipRow}>
                <View style={styles.chip}>
                  <Feather name="credit-card" size={13} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.chipText}>Contactless Card</Text>
                </View>
                <View style={styles.chip}>
                  <Feather name="smartphone" size={13} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.chipText}>Apple Pay</Text>
                </View>
                <View style={styles.chip}>
                  <Feather name="watch" size={13} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.chipText}>Apple Watch</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  readyBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  sceneWrapper: {
    width: 220,
    height: 340,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  nfcFieldWrapper: {
    position: "absolute",
    bottom: 148,
    alignItems: "center",
    justifyContent: "center",
    width: 220,
    height: 220,
  },
  fieldRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  card: {
    position: "absolute",
    top: 0,
    width: 160,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#1E3A5F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  cardChip: {
    width: 28,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#D4A843",
    marginBottom: 8,
  },
  cardStripe: {
    width: "100%",
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 10,
  },
  cardLogo: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  cardLogoCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  phoneBody: {
    width: 110,
    height: 190,
    borderRadius: 22,
    backgroundColor: "#111B2E",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  phoneNotch: {
    width: 48,
    height: 12,
    backgroundColor: BG,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: 0,
  },
  phoneScreen: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1526",
  },
  phoneLockIcon: {
    opacity: 0.5,
  },
  phoneNfcZone: {
    width: "100%",
    height: 32,
    backgroundColor: "rgba(0,114,196,0.12)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,114,196,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneNfcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    opacity: 0.8,
  },
  processingBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  approvedBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  approvedCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(52,199,89,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "rgba(52,199,89,0.4)",
  },
  approvedText: {
    color: SUCCESS,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  approvedAmount: {
    color: "#fff",
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  footer: {
    width: "100%",
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 12,
  },
  amountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  amountLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  amountValue: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  mainLabel: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  subLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  chipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
