import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ModifierGroup, ModifierOption } from "@/lib/api";
import type { Product, SelectedModifier } from "@/types/pos";
import Colors from "@/constants/colors";

type Props = {
  product: Product | null;
  visible: boolean;
  colors: typeof Colors.light;
  onConfirm: (selections: {
    selectedModifiers: SelectedModifier[];
    notes: string;
    unitQuantity?: number | null;
  }) => void;
  onCancel: () => void;
};

function GroupRow({
  group,
  selections,
  onToggleOption,
  colors,
}: {
  group: ModifierGroup;
  selections: Map<number, Set<number>>;
  onToggleOption: (groupId: number, option: ModifierOption, isSingle: boolean) => void;
  colors: typeof Colors.light;
}) {
  const chosen = selections.get(group.id) ?? new Set<number>();
  const isSingle = group.selectionType === "single";

  return (
    <View style={grpStyles.container}>
      <View style={grpStyles.header}>
        <Text style={[grpStyles.name, { color: colors.text }]}>{group.name}</Text>
        <View style={grpStyles.meta}>
          {group.isRequired && (
            <View style={grpStyles.requiredBadge}>
              <Text style={grpStyles.requiredText}>Required</Text>
            </View>
          )}
          <Text style={[grpStyles.type, { color: colors.textSecondary }]}>
            {isSingle ? "Pick one" : "Choose any"}
          </Text>
        </View>
      </View>
      {group.description ? (
        <Text style={[grpStyles.desc, { color: colors.textSecondary }]}>{group.description}</Text>
      ) : null}
      <View style={grpStyles.options}>
        {group.options.map((opt) => {
          const isChosen = chosen.has(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                grpStyles.option,
                { borderColor: isChosen ? colors.accent : colors.border },
                isChosen && { backgroundColor: colors.accent + "10" },
              ]}
              onPress={() => onToggleOption(group.id, opt, isSingle)}
              activeOpacity={0.7}
            >
              <View style={grpStyles.optLeft}>
                {isSingle ? (
                  <View style={[grpStyles.radio, { borderColor: isChosen ? colors.accent : colors.border }]}>
                    {isChosen && <View style={[grpStyles.radioInner, { backgroundColor: colors.accent }]} />}
                  </View>
                ) : (
                  <View style={[grpStyles.checkbox, { borderColor: isChosen ? colors.accent : colors.border, backgroundColor: isChosen ? colors.accent : "transparent" }]}>
                    {isChosen && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                )}
                <Text style={[grpStyles.optName, { color: colors.text }]}>{opt.name}</Text>
              </View>
              {opt.priceAdjustment !== 0 && (
                <Text style={[grpStyles.optPrice, { color: opt.priceAdjustment > 0 ? colors.accent : "#16a34a" }]}>
                  {opt.priceAdjustment > 0 ? `+$${opt.priceAdjustment.toFixed(2)}` : `-$${Math.abs(opt.priceAdjustment).toFixed(2)}`}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const grpStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  requiredBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  requiredText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#991B1B" },
  type: { fontSize: 12, fontFamily: "Inter_400Regular" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  options: { gap: 6 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1 },
  optLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  optName: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  optPrice: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

export function ModifierSheet({ product, visible, colors, onConfirm, onCancel }: Props) {
  const [selections, setSelections] = useState<Map<number, Set<number>>>(new Map());
  const [notes, setNotes] = useState("");
  const [unitQuantityStr, setUnitQuantityStr] = useState("1");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["product-modifiers", product?.id],
    queryFn: () => api.modifiers.getForProduct(product!.id),
    enabled: visible && !!product,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (visible && product) {
      setSelections(new Map());
      setNotes("");
      setUnitQuantityStr(
        product.pricingType === "hourly" ? "1" :
        product.pricingType === "weight" ? "0.25" : "1"
      );
    }
  }, [visible, product?.id]);

  const toggleOption = useCallback(
    (groupId: number, option: ModifierOption, isSingle: boolean) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current = new Set(next.get(groupId) ?? []);
        if (isSingle) {
          if (current.has(option.id)) {
            current.clear();
          } else {
            current.clear();
            current.add(option.id);
          }
        } else {
          if (current.has(option.id)) current.delete(option.id);
          else current.add(option.id);
        }
        next.set(groupId, current);
        return next;
      });
    },
    []
  );

  const selectedModifiers = useMemo<SelectedModifier[]>(() => {
    if (!groups) return [];
    const result: SelectedModifier[] = [];
    for (const group of groups) {
      const chosen = selections.get(group.id) ?? new Set();
      for (const optId of chosen) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceAdjustment: opt.priceAdjustment,
          });
        }
      }
    }
    return result;
  }, [groups, selections]);

  const modifierTotal = useMemo(
    () => selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0),
    [selectedModifiers]
  );

  const unitQty = parseFloat(unitQuantityStr) || 0;
  const basePrice = product?.price ?? 0;
  const unitPrice = basePrice + modifierTotal;
  const totalPrice = unitQty > 0 && product?.pricingType !== "fixed"
    ? unitPrice * unitQty
    : unitPrice;

  const missingRequired = useMemo(() => {
    if (!groups) return [];
    return groups.filter((g) => {
      if (!g.isRequired) return false;
      const chosen = selections.get(g.id);
      return !chosen || chosen.size === 0;
    });
  }, [groups, selections]);

  const canConfirm = missingRequired.length === 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      selectedModifiers,
      notes,
      unitQuantity: product?.pricingType !== "fixed" ? (unitQty || null) : null,
    });
  };

  if (!product) return null;

  const isPriced = product.pricingType !== "fixed";
  const unitLabel = product.unit ?? (product.pricingType === "hourly" ? "hr" : "unit");

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={[styles.productHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.productInfo}>
              {product.emoji ? <Text style={styles.emoji}>{product.emoji}</Text> : null}
              <View>
                <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                {product.description ? (
                  <Text style={[styles.productDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {product.description}
                  </Text>
                ) : null}
                <Text style={[styles.basePrice, { color: colors.textSecondary }]}>
                  ${basePrice.toFixed(2)}{isPriced ? ` / ${unitLabel}` : ""}
                </Text>
              </View>
            </View>
            {product.isBundle && product.bundleItems && (
              <View style={[styles.bundleTag, { borderColor: colors.border }]}>
                <Ionicons name="gift" size={12} color={colors.accent} />
                <Text style={[styles.bundleTagText, { color: colors.accent }]}>
                  Includes: {product.bundleItems.map((b) => `${b.quantity}× ${b.name}`).join(", ")}
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isPriced && (
              <View style={styles.unitSection}>
                <Text style={[styles.unitLabel, { color: colors.text }]}>
                  {product.pricingType === "hourly" ? "Duration (hours)" : `Quantity (${unitLabel})`}
                </Text>
                <View style={[styles.unitInputRow, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.unitBtn}
                    onPress={() => {
                      const v = Math.max(0, parseFloat(unitQuantityStr || "0") - (product.pricingType === "hourly" ? 0.5 : 0.25));
                      setUnitQuantityStr(v.toFixed(2).replace(/\.00$/, ""));
                    }}
                  >
                    <Ionicons name="remove" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.unitInput, { color: colors.text }]}
                    value={unitQuantityStr}
                    onChangeText={setUnitQuantityStr}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.unitSuffix, { color: colors.textSecondary }]}>{unitLabel}</Text>
                  <TouchableOpacity
                    style={styles.unitBtn}
                    onPress={() => {
                      const v = parseFloat(unitQuantityStr || "0") + (product.pricingType === "hourly" ? 0.5 : 0.25);
                      setUnitQuantityStr(v.toFixed(2).replace(/\.00$/, ""));
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
            ) : groups && groups.length > 0 ? (
              <>
                {groups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    selections={selections}
                    onToggleOption={toggleOption}
                    colors={colors}
                  />
                ))}
              </>
            ) : null}

            <View style={styles.notesSection}>
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Special Instructions (optional)</Text>
              <TextInput
                style={[styles.notesInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="E.g. no cilantro, sauce on the side..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {missingRequired.length > 0 && (
              <Text style={styles.missingText}>
                Select: {missingRequired.map((g) => g.name).join(", ")}
              </Text>
            )}
            <View style={[styles.priceSummary, { borderBottomColor: colors.border }]}>
              <Text style={[styles.priceSummaryLabel, { color: colors.textSecondary }]}>
                {isPriced ? `${unitQty} ${unitLabel} × $${unitPrice.toFixed(2)}` : "Item total"}
              </Text>
              <Text style={[styles.priceSummaryTotal, { color: colors.accent }]}>
                ${totalPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary }]}
                onPress={onCancel}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: canConfirm ? colors.accent : colors.border, flex: 2 }]}
                onPress={handleConfirm}
                disabled={!canConfirm}
              >
                <Ionicons name="cart" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>
                  Add to Order · ${totalPrice.toFixed(2)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", overflow: "hidden" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginTop: 10, marginBottom: 6 },
  productHeader: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  productInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emoji: { fontSize: 32, marginTop: 2 },
  productName: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  productDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  basePrice: { fontSize: 13, fontFamily: "Inter_500Medium" },
  bundleTag: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 4 },
  bundleTagText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20, paddingBottom: 8 },
  unitSection: { marginBottom: 20 },
  unitLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  unitInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  unitBtn: { padding: 12 },
  unitInput: { flex: 1, textAlign: "center", fontSize: 18, fontFamily: "Inter_700Bold", paddingVertical: 10 },
  unitSuffix: { fontSize: 13, fontFamily: "Inter_400Regular", paddingRight: 12 },
  notesSection: { marginTop: 4, gap: 6 },
  notesLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  notesInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 60 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  missingText: { fontSize: 12, color: "#DC2626", fontFamily: "Inter_500Medium", textAlign: "center" },
  priceSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  priceSummaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  priceSummaryTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  btnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});

export default ModifierSheet;
