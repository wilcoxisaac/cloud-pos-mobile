import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useColorScheme,
  SectionList,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type RestaurantTable, type Reservation } from "@/lib/api";
import Colors from "@/constants/colors";
import BackButton from "@/components/BackButton";

const STATUS_META: Record<
  RestaurantTable["status"],
  { label: string; color: string; bg: string; icon: string }
> = {
  available: { label: "Available", color: "#166534", bg: "#DCFCE7", icon: "checkmark-circle" },
  occupied:  { label: "Occupied",  color: "#92400E", bg: "#FEF3C7", icon: "people"          },
  reserved:  { label: "Reserved",  color: "#1E3A8A", bg: "#DBEAFE", icon: "time"            },
  cleaning:  { label: "Cleaning",  color: "#9D174D", bg: "#FCE7F3", icon: "water"           },
};

const RES_STATUS_META: Record<
  Reservation["status"],
  { label: string; color: string; bg: string }
> = {
  pending:   { label: "Pending",   color: "#78716C", bg: "#F5F5F4" },
  confirmed: { label: "Confirmed", color: "#1E3A8A", bg: "#DBEAFE" },
  seated:    { label: "Seated",    color: "#166534", bg: "#DCFCE7" },
  "no-show": { label: "No Show",   color: "#991B1B", bg: "#FEE2E2" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function monthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateStr(s: string) { return new Date(s + "T00:00:00"); }

function buildCalendarRows(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length) { while (row.length < 7) row.push(null); rows.push(row); }
  return rows;
}

type ResCalendarWidgetProps = {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  reservationDates: Set<string>;
  displayMonth: Date;
  onChangeMonth: (d: Date) => void;
  colors: typeof import("@/constants/colors").default.light;
  expanded: boolean;
  onToggle: () => void;
};

function ResCalendarWidget({
  selectedDate, onSelectDate, reservationDates, displayMonth, onChangeMonth, colors, expanded, onToggle,
}: ResCalendarWidgetProps) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const rows = buildCalendarRows(year, month);
  const today = todayStr();
  const selectedLabel = parseDateStr(selectedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={[calStyles.calContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity style={calStyles.calHeader} onPress={onToggle} activeOpacity={0.7}>
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onChangeMonth(new Date(year, month - 1, 1)); }} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <View style={calStyles.calTitleBlock}>
          <Text style={[calStyles.calTitle, { color: colors.text }]}>{MONTH_NAMES[month]} {year}</Text>
          {!expanded && <Text style={[calStyles.calCollapsed, { color: colors.textSecondary }]}>{selectedLabel}</Text>}
        </View>
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onChangeMonth(new Date(year, month + 1, 1)); }} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={calStyles.dayLabelsRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[calStyles.dayLabel, { color: colors.textSecondary }]}>{d}</Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={calStyles.weekRow}>
              {row.map((day, di) => {
                if (!day) return <View key={di} style={calStyles.dayCell} />;
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === today;
                const hasDot = reservationDates.has(dateKey);
                return (
                  <TouchableOpacity
                    key={di}
                    style={[calStyles.dayCell, isSelected && { backgroundColor: colors.accent, borderRadius: 20 }]}
                    onPress={() => onSelectDate(dateKey)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      calStyles.dayNum,
                      { color: isSelected ? "#fff" : isToday ? colors.accent : colors.text },
                      isToday && !isSelected && { fontFamily: "Inter_700Bold" },
                    ]}>{day}</Text>
                    {hasDot && (
                      <View style={[calStyles.dot, { backgroundColor: isSelected ? "#fff" : colors.accent }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const calStyles = StyleSheet.create({
  calContainer: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 6 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  calTitleBlock: { flex: 1, alignItems: "center" },
  calTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  calCollapsed: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  dayLabelsRow: { flexDirection: "row", paddingHorizontal: 8 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_500Medium", paddingBottom: 4 },
  weekRow: { flexDirection: "row", paddingHorizontal: 8 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 5, minHeight: 36 },
  dayNum: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
});

const SECTIONS = ["Main", "Bar", "Patio"];
const TIMES_RES = [
  "5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM",
  "8:00 PM","8:30 PM","9:00 PM","9:30 PM",
];

function minutesSince(isoString: string) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatDateLabel(dateStr: string) {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const TABLE_SECTIONS = ["Main", "Bar", "Patio", "Private", "Outdoor"];

type AddTableForm = { name: string; capacity: string; section: string };

function AddTableModal({
  visible,
  colors,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  colors: typeof Colors.light;
  onClose: () => void;
  onSave: (form: AddTableForm) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<AddTableForm>({ name: "", capacity: "4", section: "Main" });
  const set = (key: keyof AddTableForm, val: string) => setForm((f) => ({ ...f, [key]: val }));

  function handleSave() {
    if (!form.name.trim()) { Alert.alert("Validation", "Table name is required"); return; }
    const cap = parseInt(form.capacity);
    if (isNaN(cap) || cap < 1 || cap > 50) { Alert.alert("Validation", "Capacity must be between 1 and 50"); return; }
    onSave(form);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Table</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Table name (e.g. T11, Patio 3) *"
              placeholderTextColor={colors.textSecondary}
              value={form.name}
              onChangeText={(v) => set("name", v)}
              autoFocus
            />

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Capacity (seats) *"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={form.capacity}
              onChangeText={(v) => set("capacity", v)}
            />

            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {TABLE_SECTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, { backgroundColor: colors.surface }, form.section === s && { backgroundColor: colors.accent }]}
                  onPress={() => set("section", s)}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary }, form.section === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? "Adding…" : "Add Table"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

type StatusModalProps = {
  table: RestaurantTable | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (status: RestaurantTable["status"]) => void;
  onDelete: () => void;
};
function StatusModal({ table, visible, onClose, onSelect, onDelete }: StatusModalProps) {
  if (!table) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Update {table.name}</Text>
          {(["available", "occupied", "reserved", "cleaning"] as const).map((s) => {
            const meta = STATUS_META[s];
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusOption, { backgroundColor: meta.bg }]}
                onPress={() => { onSelect(s); onClose(); }}
              >
                <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                <Text style={[styles.statusOptionText, { color: meta.color }]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
          {table.status !== "occupied" && (
            <TouchableOpacity
              style={[styles.statusOption, { backgroundColor: "#FEE2E2" }]}
              onPress={() => { onClose(); onDelete(); }}
            >
              <Ionicons name="trash-outline" size={20} color="#991B1B" />
              <Text style={[styles.statusOptionText, { color: "#991B1B" }]}>Remove Table</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type TableCardProps = {
  table: RestaurantTable;
  onPress: () => void;
  onLongPress: () => void;
  colors: typeof Colors.light;
};
function TableCard({ table, onPress, onLongPress, colors }: TableCardProps) {
  const meta = STATUS_META[table.status] ?? STATUS_META.available;
  const mins = table.currentOrder ? minutesSince(table.currentOrder.createdAt) : 0;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.tableName, { color: colors.text }]}>{table.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={13} color={meta.color} />
          <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{table.capacity} seats</Text>
      </View>
      {table.status === "occupied" && table.currentOrder && (
        <View style={styles.orderInfo}>
          <View style={styles.orderInfoRow}>
            <Ionicons name="time-outline" size={13} color="#92400E" />
            <Text style={styles.orderTime}>{mins}m</Text>
            {table.currentOrder.guestCount ? (
              <>
                <Ionicons name="people" size={13} color="#92400E" style={{ marginLeft: 8 }} />
                <Text style={styles.orderTime}>{table.currentOrder.guestCount} guests</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.orderTotal}>${parseFloat(table.currentOrder.total).toFixed(2)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ReservationCard({
  res,
  colors,
  onStatusChange,
}: {
  res: Reservation;
  colors: typeof Colors.light;
  onStatusChange: (id: number, status: string) => void;
}) {
  const meta = RES_STATUS_META[res.status] ?? RES_STATUS_META.confirmed;
  return (
    <View style={[styles.resCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.resCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resParty, { color: colors.text }]}>{res.partyName}</Text>
          <View style={styles.resMeta}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.resMetaText, { color: colors.textSecondary }]}>{res.reservationTime}</Text>
            <Ionicons name="people-outline" size={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
            <Text style={[styles.resMetaText, { color: colors.textSecondary }]}>{res.partySize} guests</Text>
            {res.tablePreference ? (
              <>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                <Text style={[styles.resMetaText, { color: colors.textSecondary }]}>{res.tablePreference}</Text>
              </>
            ) : null}
          </View>
          {res.notes ? (
            <Text style={[styles.resNotes, { color: colors.textSecondary }]} numberOfLines={1}>{res.notes}</Text>
          ) : null}
          {res.phone ? (
            <Text style={[styles.resPhone, { color: colors.textSecondary }]}>{res.phone}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      {(res.status === "confirmed" || res.status === "pending") && (
        <View style={styles.resActions}>
          {res.status === "pending" && (
            <TouchableOpacity
              style={[styles.resActionBtn, { backgroundColor: "#DBEAFE" }]}
              onPress={() => onStatusChange(res.id, "confirmed")}
            >
              <Text style={[styles.resActionText, { color: "#1E3A8A" }]}>Confirm</Text>
            </TouchableOpacity>
          )}
          {res.status === "confirmed" && (
            <TouchableOpacity
              style={[styles.resActionBtn, { backgroundColor: "#DCFCE7" }]}
              onPress={() => onStatusChange(res.id, "seated")}
            >
              <Ionicons name="arrow-forward-circle-outline" size={16} color="#166534" />
              <Text style={[styles.resActionText, { color: "#166534" }]}>Seat Now</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.resActionBtn, { backgroundColor: "#FEE2E2" }]}
            onPress={() => onStatusChange(res.id, "no-show")}
          >
            <Text style={[styles.resActionText, { color: "#991B1B" }]}>No Show</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resActionBtn, { backgroundColor: "#F3F4F6" }]}
            onPress={() => onStatusChange(res.id, "cancelled")}
          >
            <Text style={[styles.resActionText, { color: "#6B7280" }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

type NewResForm = {
  partyName: string;
  partySize: string;
  phone: string;
  time: string;
  section: string;
  notes: string;
};

function NewReservationModal({
  visible,
  date,
  colors,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  date: string;
  colors: typeof Colors.light;
  onClose: () => void;
  onSave: (form: NewResForm) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<NewResForm>({
    partyName: "",
    partySize: "2",
    phone: "",
    time: "7:00 PM",
    section: "",
    notes: "",
  });

  const set = (key: keyof NewResForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>New Reservation</Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>{formatDateLabel(date)}</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Party name *"
              placeholderTextColor={colors.textSecondary}
              value={form.partyName}
              onChangeText={(v) => set("partyName", v)}
            />
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Phone"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => set("phone", v)}
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Party size"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={form.partySize}
                onChangeText={(v) => set("partySize", v)}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Section</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {["Any", ...SECTIONS].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, { backgroundColor: colors.surface }, form.section === (s === "Any" ? "" : s) && { backgroundColor: colors.accent }]}
                      onPress={() => set("section", s === "Any" ? "" : s)}
                    >
                      <Text style={[styles.chipText, { color: colors.textSecondary }, form.section === (s === "Any" ? "" : s) && styles.chipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {TIMES_RES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, { backgroundColor: colors.surface }, form.time === t && { backgroundColor: colors.accent }]}
                  onPress={() => set("time", t)}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary }, form.time === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Notes"
              placeholderTextColor={colors.textSecondary}
              value={form.notes}
              onChangeText={(v) => set("notes", v)}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={() => onSave(form)}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? "Saving…" : "Reserve"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default function TablesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"floorPlan" | "reservations">("floorPlan");
  const [statusModal, setStatusModal] = useState<RestaurantTable | null>(null);
  const [addTableModal, setAddTableModal] = useState(false);
  const [resDate, setResDate] = useState(todayStr());
  const [newResModal, setNewResModal] = useState(false);
  const [tableStatusFilter, setTableStatusFilter] = useState<RestaurantTable["status"] | null>(null);
  const [resCalExpanded, setResCalExpanded] = useState(true);
  const [resDisplayMonth, setResDisplayMonth] = useState(() => new Date(todayStr() + "T00:00:00"));

  const { data: tables, isLoading: tablesLoading, refetch: refetchTables, isRefetching: tablesRefetching } = useQuery({
    queryKey: ["tables"],
    queryFn: () => api.tables.list(),
    refetchInterval: 30_000,
  });

  const { data: reservations, isLoading: resLoading, refetch: refetchRes, isRefetching: resRefetching } = useQuery({
    queryKey: ["reservations", resDate],
    queryFn: () => api.reservations.list(resDate),
    enabled: view === "reservations",
  });

  const resMonthKey = monthStr(resDisplayMonth);
  const { data: resMonthData } = useQuery({
    queryKey: ["reservations-month", resMonthKey],
    queryFn: () => api.reservations.listMonth(resMonthKey),
    enabled: view === "reservations",
  });

  const reservationDates = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of resMonthData ?? []) set.add(r.reservationDate);
    return set;
  }, [resMonthData]);

  const handleSelectResDate = React.useCallback((d: string) => {
    setResDate(d);
    const newMonth = new Date(d + "T00:00:00");
    if (monthStr(newMonth) !== resMonthKey) setResDisplayMonth(newMonth);
  }, [resMonthKey]);

  const updateTableStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.tables.updateStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createTable = useMutation({
    mutationFn: (form: AddTableForm) =>
      api.tables.create({ name: form.name.trim(), capacity: parseInt(form.capacity), section: form.section }),
    onSuccess: () => {
      setAddTableModal(false);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteTable = useMutation({
    mutationFn: (id: number) => api.tables.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  function handleDeleteTable(table: RestaurantTable) {
    Alert.alert(
      "Remove Table",
      `Remove ${table.name} from the floor plan? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteTable.mutate(table.id) },
      ]
    );
  }

  const updateResStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.reservations.updateStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reservations", resDate] }),
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createReservation = useMutation({
    mutationFn: (form: NewResForm) =>
      api.reservations.create({
        partyName: form.partyName,
        partySize: parseInt(form.partySize) || 2,
        phone: form.phone || undefined,
        reservationDate: resDate,
        reservationTime: form.time,
        tablePreference: form.section || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      setNewResModal(false);
      queryClient.invalidateQueries({ queryKey: ["reservations", resDate] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleTablePress = useCallback(
    (table: RestaurantTable) => {
      if (table.status === "occupied" && table.currentOrder) {
        router.push(`/order/${table.currentOrder.id}`);
      } else if (table.status === "available") {
        router.push({ pathname: "/new-order", params: { tableNumber: table.name } });
      } else {
        setStatusModal(table);
      }
    },
    [router]
  );

  const sections = React.useMemo(() => {
    if (!tables) return [];
    const filtered = tableStatusFilter ? tables.filter((t) => t.status === tableStatusFilter) : tables;
    const bySection: Record<string, RestaurantTable[]> = {};
    for (const t of filtered) {
      if (!bySection[t.section]) bySection[t.section] = [];
      bySection[t.section].push(t);
    }
    return Object.entries(bySection).map(([title, data]) => ({ title, data }));
  }, [tables, tableStatusFilter]);

  const stats = React.useMemo(() => {
    if (!tables) return { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    return tables.reduce(
      (acc, t) => ({ ...acc, [t.status]: (acc[t.status as keyof typeof acc] || 0) + 1 }),
      { available: 0, occupied: 0, reserved: 0, cleaning: 0 }
    );
  }, [tables]);

  const isLoading = view === "floorPlan" ? tablesLoading : resLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {view === "floorPlan" ? "Floor Plan" : "Reservations"}
        </Text>
        <View style={[styles.segControl, { backgroundColor: colors.backgroundSecondary }]}>
          <TouchableOpacity
            style={[styles.seg, view === "floorPlan" && { backgroundColor: colors.accent }]}
            onPress={() => setView("floorPlan")}
          >
            <Text style={[styles.segText, view === "floorPlan" && { color: "#fff" }]}>Floor Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seg, view === "reservations" && { backgroundColor: colors.accent }]}
            onPress={() => setView("reservations")}
          >
            <Text style={[styles.segText, view === "reservations" && { color: "#fff" }]}>Reservations</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 80 }} />
      ) : view === "floorPlan" ? (
        <>
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {(["available", "occupied", "reserved", "cleaning"] as const).map((s) => {
              const active = tableStatusFilter === s;
              const dimmed = tableStatusFilter !== null && !active;
              return (
                <TouchableOpacity
                  key={s}
                  style={styles.statItem}
                  onPress={() => setTableStatusFilter(active ? null : s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statCount, { color: STATUS_META[s].color, opacity: dimmed ? 0.35 : 1 }]}>{stats[s]}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, opacity: dimmed ? 0.35 : 1 }]}>{STATUS_META[s].label}</Text>
                  {active && <View style={[styles.statUnderline, { backgroundColor: STATUS_META[s].color }]} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.addTableBtn, { backgroundColor: colors.accent }]}
              onPress={() => setAddTableModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl refreshing={tablesRefetching} onRefresh={refetchTables} tintColor={colors.accent} />
            }
            contentContainerStyle={styles.listContent}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
            )}
            renderItem={({ item }) => (
              <TableCard
                table={item}
                onPress={() => handleTablePress(item)}
                onLongPress={() => setStatusModal(item)}
                colors={colors}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tables found</Text>
              </View>
            }
          />
        </>
      ) : (
        <>
          <ResCalendarWidget
            selectedDate={resDate}
            onSelectDate={handleSelectResDate}
            reservationDates={reservationDates}
            displayMonth={resDisplayMonth}
            onChangeMonth={(d) => setResDisplayMonth(d)}
            colors={colors}
            expanded={resCalExpanded}
            onToggle={() => setResCalExpanded((v) => !v)}
          />
          <View style={[styles.resActionRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.resActionLabel, { color: colors.textSecondary }]}>
              {formatDateLabel(resDate)}
            </Text>
            <TouchableOpacity
              style={[styles.addResBtn, { backgroundColor: colors.accent }]}
              onPress={() => setNewResModal(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addResBtnText}>New Reservation</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={reservations ?? []}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl refreshing={resRefetching} onRefresh={refetchRes} tintColor={colors.accent} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ReservationCard
                res={item}
                colors={colors}
                onStatusChange={(id, status) => updateResStatus.mutate({ id, status })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No reservations for {formatDateLabel(resDate)}
                </Text>
              </View>
            }
          />
        </>
      )}

      <StatusModal
        table={statusModal}
        visible={!!statusModal}
        onClose={() => setStatusModal(null)}
        onSelect={(status) => {
          if (statusModal) updateTableStatus.mutate({ id: statusModal.id, status });
        }}
        onDelete={() => {
          if (statusModal) handleDeleteTable(statusModal);
          setStatusModal(null);
        }}
      />

      <AddTableModal
        visible={addTableModal}
        colors={colors}
        onClose={() => setAddTableModal(false)}
        onSave={(form) => createTable.mutate(form)}
        isSaving={createTable.isPending}
      />

      <NewReservationModal
        visible={newResModal}
        date={resDate}
        colors={colors}
        onClose={() => setNewResModal(false)}
        onSave={(form) => createReservation.mutate(form)}
        isSaving={createReservation.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
    gap: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  segControl: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  seg: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  segText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: "center", paddingBottom: 8, paddingTop: 2 },
  addTableBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0072C4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginLeft: 4,
  },
  statUnderline: { position: "absolute", bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  statCount: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 120 },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tableName: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#FDE68A",
  },
  orderInfoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  orderTime: { fontSize: 13, color: "#92400E", fontFamily: "Inter_500Medium" },
  orderTotal: { fontSize: 14, fontWeight: "600", color: "#92400E", fontFamily: "Inter_600SemiBold" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#1e293b",
    marginBottom: 4,
    textAlign: "center",
  },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 4 },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  statusOptionText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cancelBtn: {
    flex: 1,
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  resActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resActionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addResBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addResBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  resCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  resCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  resParty: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 4 },
  resMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  resMetaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resNotes: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 4 },
  resPhone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  resActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  resActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowInputs: { flexDirection: "row", gap: 10 },
  pickerLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  chipRow: { flexDirection: "row" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#0072C4" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569" },
  chipTextActive: { color: "#fff" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
