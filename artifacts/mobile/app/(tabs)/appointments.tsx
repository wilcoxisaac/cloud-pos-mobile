import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type Appointment } from "@/lib/api";
import Colors from "@/constants/colors";
import BackButton from "@/components/BackButton";

const STATUS_META: Record<
  Appointment["status"],
  { label: string; color: string; bg: string; icon: string }
> = {
  pending:       { label: "Pending",     color: "#78716C", bg: "#F5F5F4", icon: "ellipse-outline" },
  confirmed:     { label: "Confirmed",   color: "#1E3A8A", bg: "#DBEAFE", icon: "checkmark-circle-outline" },
  "in-progress": { label: "In Progress", color: "#166534", bg: "#DCFCE7", icon: "play-circle" },
  completed:     { label: "Completed",   color: "#374151", bg: "#F3F4F6", icon: "checkmark-done-circle" },
  "no-show":     { label: "No Show",     color: "#991B1B", bg: "#FEE2E2", icon: "close-circle" },
};

const STAFF = ["Jordan Lee", "Morgan Scott", "Taylor Kim", "Alex Rivera", "Jamie Chen"];
const SERVICES = [
  { name: "Haircut", duration: 45 },
  { name: "Color Treatment", duration: 90 },
  { name: "Massage (60 min)", duration: 60 },
  { name: "Manicure", duration: 30 },
  { name: "Pedicure", duration: 45 },
  { name: "Facial", duration: 60 },
];
const TIMES = [
  "8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM",
  "2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM",
  "5:00 PM","5:30 PM","6:00 PM",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function monthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateStr(d: string): Date {
  return new Date(d + "T00:00:00");
}

function CalendarWidget({
  selectedDate,
  onSelectDate,
  appointmentDates,
  displayMonth,
  onChangeMonth,
  colors,
  expanded,
  onToggle,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  appointmentDates: Set<string>;
  displayMonth: Date;
  onChangeMonth: (d: Date) => void;
  colors: typeof Colors.light;
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = todayStr();
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    onChangeMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    onChangeMonth(d);
  };

  const selDate = parseDateStr(selectedDate);
  const selLabel = `${selDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;

  return (
    <View style={[calStyles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity style={calStyles.nav} onPress={onToggle} activeOpacity={0.7}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <View style={calStyles.navCenter}>
          <Text style={[calStyles.monthLabel, { color: colors.text }]}>
            {MONTH_NAMES[month]} {year}
          </Text>
          {!expanded && (
            <Text style={[calStyles.collapsedDate, { color: colors.textSecondary }]}>{selLabel}</Text>
          )}
        </View>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={calStyles.dayRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[calStyles.dayLabel, { color: colors.textSecondary }]}>{d}</Text>
            ))}
          </View>

          <View style={calStyles.grid}>
            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIdx) => (
              <View key={rowIdx} style={calStyles.weekRow}>
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((dateStr, colIdx) => {
                  if (!dateStr) return <View key={colIdx} style={calStyles.cell} />;
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === today;
                  const hasAppts = appointmentDates.has(dateStr);
                  const dayNum = parseDateStr(dateStr).getDate();
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      style={[
                        calStyles.cell,
                        isSelected && { backgroundColor: colors.accent },
                        !isSelected && isToday && { backgroundColor: colors.accent + "20" },
                      ]}
                      onPress={() => onSelectDate(dateStr)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          calStyles.dayNum,
                          { color: isSelected ? "#fff" : isToday ? colors.accent : colors.text },
                        ]}
                      >
                        {dayNum}
                      </Text>
                      {hasAppts && (
                        <View
                          style={[
                            calStyles.dot,
                            { backgroundColor: isSelected ? "#fff" : "#0072C4" },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nav: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  navBtn: { padding: 6 },
  navCenter: { flex: 1, alignItems: "center" },
  monthLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  collapsedDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dayRow: { flexDirection: "row", marginBottom: 4 },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  grid: { gap: 2 },
  weekRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    gap: 2,
  },
  dayNum: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dot: { width: 5, height: 5, borderRadius: 3 },
});

type ApptCardProps = {
  appt: Appointment;
  colors: typeof Colors.light;
  onAction: (appt: Appointment) => void;
};
function ApptCard({ appt, colors, onAction }: ApptCardProps) {
  const meta = STATUS_META[appt.status] ?? STATUS_META.pending;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        <View style={[styles.timePill, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.timeText, { color: colors.text }]}>{appt.appointmentTime}</Text>
          <Text style={[styles.durText, { color: colors.textSecondary }]}>{appt.durationMinutes}m</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
            {appt.clientName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={[styles.serviceText, { color: colors.accent }]} numberOfLines={1}>
          {appt.serviceName}
        </Text>
        {appt.staffName ? (
          <View style={styles.staffRow}>
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.staffText, { color: colors.textSecondary }]}>{appt.staffName}</Text>
          </View>
        ) : null}
        {appt.notes ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={1}>
            {appt.notes}
          </Text>
        ) : null}
        {appt.status !== "completed" && appt.status !== "no-show" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: meta.bg }]}
            onPress={() => onAction(appt)}
          >
            <Text style={[styles.actionBtnText, { color: meta.color }]}>
              {appt.status === "pending" && "Confirm"}
              {appt.status === "confirmed" && "Start Service"}
              {appt.status === "in-progress" && "Complete / No-show"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

type NewApptModalProps = {
  visible: boolean;
  onClose: () => void;
  date: string;
  colors: typeof Colors.light;
};
function NewApptModal({ visible, onClose, date, colors }: NewApptModalProps) {
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [service, setService] = useState(SERVICES[0]);
  const [staff, setStaff] = useState(STAFF[0]);
  const [time, setTime] = useState(TIMES[2]);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "service" | "staff" | "time">("form");

  const createMut = useMutation({
    mutationFn: () =>
      api.appointments.create({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        serviceName: service.name,
        staffName: staff,
        appointmentDate: date,
        appointmentTime: time,
        durationMinutes: service.duration,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-month"] });
      handleClose();
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  function handleClose() {
    setClientName(""); setClientPhone(""); setService(SERVICES[0]);
    setStaff(STAFF[0]); setTime(TIMES[2]); setNotes(""); setStep("form");
    onClose();
  }

  function handleSave() {
    if (!clientName.trim()) { Alert.alert("Required", "Client name is required"); return; }
    createMut.mutate();
  }

  if (step === "service") {
    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={() => setStep("form")}>
        <Pressable style={styles.overlay} onPress={() => setStep("form")}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Service</Text>
            <ScrollView>
              {SERVICES.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[styles.pickOption, service.name === s.name && { backgroundColor: colors.accent + "18" }]}
                  onPress={() => { setService(s); setStep("form"); }}
                >
                  <Text style={[styles.pickOptionText, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[styles.pickOptionSub, { color: colors.textSecondary }]}>{s.duration} min</Text>
                  {service.name === s.name && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (step === "staff") {
    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={() => setStep("form")}>
        <Pressable style={styles.overlay} onPress={() => setStep("form")}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Stylist</Text>
            <ScrollView>
              {STAFF.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pickOption, staff === s && { backgroundColor: colors.accent + "18" }]}
                  onPress={() => { setStaff(s); setStep("form"); }}
                >
                  <Text style={[styles.pickOptionText, { color: colors.text }]}>{s}</Text>
                  {staff === s && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (step === "time") {
    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={() => setStep("form")}>
        <Pressable style={styles.overlay} onPress={() => setStep("form")}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Time</Text>
            <ScrollView>
              {TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pickOption, time === t && { backgroundColor: colors.accent + "18" }]}
                  onPress={() => { setTime(t); setStep("form"); }}
                >
                  <Text style={[styles.pickOptionText, { color: colors.text }]}>{t}</Text>
                  {time === t && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>New Appointment</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Client Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Full name"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="(612) 555-0000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Service</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => setStep("service")}
              >
                <Text style={[styles.pickerValue, { color: colors.text }]}>{service.name}</Text>
                <View style={styles.pickerRight}>
                  <Text style={[styles.pickerSub, { color: colors.textSecondary }]}>{service.duration} min</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stylist</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => setStep("staff")}
              >
                <Text style={[styles.pickerValue, { color: colors.text }]}>{staff}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Time</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => setStep("time")}
              >
                <Text style={[styles.pickerValue, { color: colors.text }]}>{time}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Allergies, preferences, etc."
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.accent }, createMut.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Book Appointment</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function AppointmentsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const queryClient = useQueryClient();

  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(today + "T00:00:00"));
  const [showNew, setShowNew] = useState(false);
  const [calExpanded, setCalExpanded] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const currentMonthKey = monthStr(displayMonth);

  const { data: monthAppts } = useQuery({
    queryKey: ["appointments-month", currentMonthKey],
    queryFn: () => api.appointments.listMonth(currentMonthKey),
  });

  const appointmentDates = useMemo(() => {
    const set = new Set<string>();
    (monthAppts ?? []).forEach((a) => set.add(a.appointmentDate));
    return set;
  }, [monthAppts]);

  const { data: appts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: () => api.appointments.list(selectedDate),
    refetchInterval: 60_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Appointment["status"] }) =>
      api.appointments.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-month"] });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const handleAction = useCallback(
    (appt: Appointment) => {
      if (appt.status === "pending") {
        updateStatus.mutate({ id: appt.id, status: "confirmed" });
      } else if (appt.status === "confirmed") {
        updateStatus.mutate({ id: appt.id, status: "in-progress" });
      } else if (appt.status === "in-progress") {
        Alert.alert("Update Status", `What happened with ${appt.clientName}'s appointment?`, [
          { text: "Complete", onPress: () => updateStatus.mutate({ id: appt.id, status: "completed" }) },
          { text: "No Show",  style: "destructive", onPress: () => updateStatus.mutate({ id: appt.id, status: "no-show" }) },
          { text: "Cancel",   style: "cancel" },
        ]);
      }
    },
    [updateStatus]
  );

  const stats = useMemo(() => {
    if (!appts) return { total: 0, completed: 0, inProgress: 0, upcoming: 0 };
    return {
      total: appts.length,
      completed: appts.filter((a) => a.status === "completed").length,
      inProgress: appts.filter((a) => a.status === "in-progress").length,
      upcoming: appts.filter((a) => a.status === "confirmed" || a.status === "pending").length,
    };
  }, [appts]);

  const allSections = useMemo(() => {
    if (!appts) return [];
    const groups: Record<string, Appointment[]> = {
      "In Progress": [],
      "Upcoming": [],
      "Completed": [],
      "No Show": [],
    };
    for (const a of appts) {
      if (a.status === "in-progress") groups["In Progress"].push(a);
      else if (a.status === "confirmed" || a.status === "pending") groups["Upcoming"].push(a);
      else if (a.status === "completed") groups["Completed"].push(a);
      else if (a.status === "no-show") groups["No Show"].push(a);
    }
    return Object.entries(groups)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [appts]);

  const FILTER_TO_SECTION: Record<string, string> = {
    "in-progress": "In Progress",
    "upcoming": "Upcoming",
    "completed": "Completed",
    "no-show": "No Show",
  };

  const sections = useMemo(
    () => statusFilter ? allSections.filter((s) => s.title === FILTER_TO_SECTION[statusFilter]) : allSections,
    [allSections, statusFilter]
  );

  const APPT_STATS = [
    { key: null,          label: "Total",       value: stats.total,      color: "#1e293b" },
    { key: "in-progress", label: "In Progress", value: stats.inProgress, color: "#166534" },
    { key: "upcoming",    label: "Upcoming",    value: stats.upcoming,   color: "#1E3A8A" },
    { key: "completed",   label: "Done",        value: stats.completed,  color: "#374151" },
  ];

  const handleSelectDate = useCallback((d: string) => {
    setSelectedDate(d);
    const newMonth = new Date(d + "T00:00:00");
    if (monthStr(newMonth) !== currentMonthKey) {
      setDisplayMonth(newMonth);
    }
  }, [currentMonthKey]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appointments</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.accent }]}
          onPress={() => setShowNew(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <CalendarWidget
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        appointmentDates={appointmentDates}
        displayMonth={displayMonth}
        onChangeMonth={(d) => setDisplayMonth(d)}
        colors={colors}
        expanded={calExpanded}
        onToggle={() => setCalExpanded((v) => !v)}
      />

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {APPT_STATS.map((s) => {
          const active = statusFilter === s.key;
          const dimmed = statusFilter !== null && !active;
          return (
            <TouchableOpacity
              key={String(s.key)}
              style={styles.statItem}
              onPress={() => setStatusFilter(active ? null : s.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.statCount, { color: s.color, opacity: dimmed ? 0.35 : 1 }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, opacity: dimmed ? 0.35 : 1 }]}>{s.label}</Text>
              {active && <View style={[styles.statUnderline, { backgroundColor: s.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
          }
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
          )}
          renderItem={({ item }) => (
            <ApptCard appt={item} colors={colors} onAction={handleAction} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No appointments for this day</Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                onPress={() => setShowNew(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Book Appointment</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <NewApptModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        date={selectedDate}
        colors={colors}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: "center", paddingBottom: 8, paddingTop: 2 },
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
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardLeft: { alignItems: "center" },
  timePill: {
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    minWidth: 64,
  },
  timeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  durText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clientName: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  serviceText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  staffText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  actionBtn: {
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 12 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notesInput: { minHeight: 70, textAlignVertical: "top" },
  picker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  pickerValue: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  pickerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  pickerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  pickOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickOptionText: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
  pickOptionSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 8 },
  saveBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
