import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CustomerSummary, type CustomerDetail } from "@/lib/api";
import BackButton from "@/components/BackButton";
import Colors from "@/constants/colors";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 84 : 64;
const TIER_ORDER = ["All", "Bronze", "Silver", "Gold", "Platinum"] as const;

type TierFilter = (typeof TIER_ORDER)[number];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDays(d: number | null) {
  if (d === null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${d.toFixed(1)}d`;
}
function statusColor(s: string) {
  if (s === "paid" || s === "accepted") return "#16a34a";
  if (s === "unpaid" || s === "sent" || s === "draft") return "#ca8a04";
  if (s === "overdue") return "#dc2626";
  return "#6b7280";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

const TIER_ICON: Record<string, string> = {
  Bronze: "🥉",
  Silver: "🥈",
  Gold: "🥇",
  Platinum: "💎",
};

const TIER_THRESHOLDS = [
  { name: "Bronze", min: 0, max: 499, color: "#B45309", bg: "#B4530918" },
  { name: "Silver", min: 500, max: 1999, color: "#6B7280", bg: "#6B728018" },
  { name: "Gold", min: 2000, max: 4999, color: "#D97706", bg: "#D9770618" },
  { name: "Platinum", min: 5000, max: Infinity, color: "#7C3AED", bg: "#7C3AED18" },
];

function TierBadge({ tier, color, bg, size = "sm" }: { tier: string; color: string; bg: string; size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "lg" ? 13 : size === "md" ? 12 : 10;
  const pad = size === "lg" ? { paddingHorizontal: 10, paddingVertical: 5 } : size === "md" ? { paddingHorizontal: 8, paddingVertical: 4 } : { paddingHorizontal: 6, paddingVertical: 3 };
  return (
    <View style={[tb.badge, pad, { backgroundColor: bg, borderColor: color + "60" }]}>
      <Text style={{ fontSize: fontSize - 1 }}>{TIER_ICON[tier] ?? "⭐"}</Text>
      <Text style={[tb.label, { fontSize, color }]}>{tier}</Text>
    </View>
  );
}
const tb = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, borderWidth: 1 },
  label: { fontFamily: "Inter_600SemiBold" },
});

function TierProgressBar({ points, tierColor, tierNextThreshold, tierProgress }: {
  points: number; tierColor: string; tierNextThreshold: number; tierProgress: number;
}) {
  const progress = Math.min(1, Math.max(0, tierProgress));
  const isMax = tierNextThreshold === 5000 && points >= 5000;
  return (
    <View style={pb.wrap}>
      <View style={[pb.track, { backgroundColor: tierColor + "22" }]}>
        <View style={[pb.fill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: tierColor }]} />
      </View>
      {isMax ? (
        <Text style={[pb.label, { color: tierColor }]}>Max tier reached 🎉</Text>
      ) : (
        <Text style={[pb.label, { color: tierColor }]}>
          {points.toLocaleString()} / {tierNextThreshold.toLocaleString()} pts to next tier
        </Text>
      )}
    </View>
  );
}
const pb = StyleSheet.create({
  wrap: { gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

function InitialAvatar({ name, size = 40, color = "#0072C4" }: { name: string; size?: number; color?: string }) {
  const initials = name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[av.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontFamily: "Inter_700Bold" },
});

function CustomerCard({ c, colors, onPress }: { c: CustomerSummary; colors: typeof Colors.light; onPress: () => void }) {
  return (
    <TouchableOpacity style={[cc.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.75}>
      <InitialAvatar name={c.name} color={c.tierColor} />
      <View style={{ flex: 1, marginLeft: 12, gap: 3 }}>
        <Text style={[cc.name, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
        {c.email ? <Text style={[cc.sub, { color: colors.textSecondary }]} numberOfLines={1}>{c.email}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <TierBadge tier={c.tier} color={c.tierColor} bg={c.tierBg} />
          {c.visits > 0 && (
            <Text style={[cc.sub, { color: colors.textSecondary }]}>{c.visits} visit{c.visits !== 1 ? "s" : ""}</Text>
          )}
          {c.lastVisit ? <Text style={[cc.sub, { color: colors.textSecondary }]}>· {fmtDate(c.lastVisit)}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[cc.spend, { color: colors.text }]}>{fmt(c.totalSpend)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Ionicons name="star" size={11} color={c.tierColor} />
          <Text style={[cc.pts, { color: c.tierColor }]}>{c.loyaltyPoints.toLocaleString()}</Text>
        </View>
        <Text style={[cc.sub, { color: colors.textSecondary }]}>{c.invoiceCount + c.orderCount} purchases</Text>
      </View>
    </TouchableOpacity>
  );
}
const cc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  spend: { fontSize: 14, fontFamily: "Inter_700Bold" },
  pts: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

function StatCell({ label, value, sub, color, colors }: { label: string; value: string; sub?: string; color?: string; colors: typeof Colors.light }) {
  return (
    <View style={sc.cell}>
      <Text style={[sc.value, { color: color ?? colors.text }]}>{value}</Text>
      {sub ? <Text style={[sc.sub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      <Text style={[sc.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  cell: { alignItems: "center", flex: 1 },
  value: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
});

function PurchaseRow({ label, value, sub, colors }: { label: string; value: string; sub?: string; colors: typeof Colors.light }) {
  return (
    <View style={[pr.row, { borderBottomColor: colors.border }]}>
      <Text style={[pr.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[pr.value, { color: colors.text }]}>{value}</Text>
        {sub ? <Text style={[pr.sub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}
const pr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});

function SectionHeader({ title, colors }: { title: string; colors: typeof Colors.light }) {
  return <Text style={[sh2.t, { color: colors.textSecondary }]}>{title}</Text>;
}
const sh2 = StyleSheet.create({ t: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 6, marginHorizontal: 16 } });

function Card({ colors, children, style }: { colors: typeof Colors.light; children: React.ReactNode; style?: object }) {
  return <View style={[card.box, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}
const card = StyleSheet.create({ box: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" } });

function CustomerDetailModal({ id, colors, onClose }: { id: number; colors: typeof Colors.light; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<CustomerDetail>({
    queryKey: ["customer", id],
    queryFn: () => api.customers.get(id),
    staleTime: 30_000,
    retry: 1,
  });

  const allDocs = data
    ? [
        ...data.quotes.map((q) => ({ ...q, type: "Quote" as const, number: q.quoteNumber })),
        ...data.invoices.map((i) => ({ ...i, type: "Invoice" as const, number: i.invoiceNumber })),
        ...data.orders.map((o) => ({ ...o, type: "Order" as const, number: o.orderNumber })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return (
    <Modal
      animationType="slide"
      visible
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={[dm.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[dm.headerTitle, { color: colors.text }]}>Customer Profile</Text>
          <View style={{ width: 34 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#0072C4" />
          </View>
        ) : error || !data ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Ionicons name="alert-circle-outline" size={40} color="#dc2626" />
            <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Failed to load customer</Text>
            {error ? <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>{String((error as Error).message ?? error)}</Text> : null}
            <TouchableOpacity
              style={{ marginTop: 8, backgroundColor: "#0072C4", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
              onPress={() => qc.invalidateQueries({ queryKey: ["customer", id] })}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            <View style={[dm.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <InitialAvatar name={data.name} size={60} color={data.tierColor} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[dm.heroName, { color: colors.text }]}>{data.name}</Text>
                {data.email ? <Text style={[dm.heroSub, { color: colors.textSecondary }]}>{data.email}</Text> : null}
                {data.phone ? <Text style={[dm.heroSub, { color: colors.textSecondary }]}>{data.phone}</Text> : null}
                <View style={{ marginTop: 8 }}>
                  <TierBadge tier={data.tier} color={data.tierColor} bg={data.tierBg} size="md" />
                </View>
              </View>
              {data.cloudPosId ? (
                <View style={[dm.syncedBadge, { backgroundColor: "#16a34a18", borderColor: "#16a34a40" }]}>
                  <Ionicons name="cloud-done-outline" size={12} color="#16a34a" />
                  <Text style={[dm.syncedText, { color: "#16a34a" }]}>Synced</Text>
                </View>
              ) : null}
            </View>

            <View style={[dm.loyaltyCard, { backgroundColor: data.tierBg, borderColor: data.tierColor + "40" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Ionicons name="star" size={18} color={data.tierColor} />
                <Text style={[dm.pointsText, { color: data.tierColor }]}>{data.loyaltyPoints.toLocaleString()} points</Text>
              </View>
              <TierProgressBar
                points={data.loyaltyPoints}
                tierColor={data.tierColor}
                tierNextThreshold={data.tierNextThreshold}
                tierProgress={data.tierProgress}
              />
            </View>

            <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 16, gap: 10 }}>
              <View style={[dm.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <StatCell label="Total Spend" value={fmt(data.stats.totalSpend)} colors={colors} color={colors.text} />
              </View>
              <View style={[dm.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <StatCell label="Visits" value={String(data.visits)} sub={data.lastVisit ? `Last: ${fmtDate(data.lastVisit)}` : undefined} colors={colors} />
              </View>
              <View style={[dm.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <StatCell label="Orders" value={String(data.stats.invoiceCount + data.stats.orderCount)} colors={colors} />
              </View>
            </View>

            <SectionHeader title="Performance" colors={colors} />
            <Card colors={colors}>
              <PurchaseRow label="Avg. Quote Accept Time" value={fmtDays(data.stats.avgQuoteAcceptDays)} colors={colors} />
              <PurchaseRow label="Avg. Invoice Pay Time" value={fmtDays(data.stats.avgInvoicePayDays)} colors={colors} />
              <PurchaseRow label="Accepted Quotes" value={`${data.stats.acceptedQuoteCount} / ${data.stats.quoteCount}`} colors={colors} />
              <PurchaseRow label="Paid Invoices" value={`${data.stats.paidInvoiceCount} / ${data.stats.invoiceCount}`} colors={colors} />
            </Card>

            {data.notes ? (
              <>
                <SectionHeader title="Notes" colors={colors} />
                <Card colors={colors}>
                  <Text style={[dm.notes, { color: colors.text }]}>{data.notes}</Text>
                </Card>
              </>
            ) : null}

            {data.stats.topItems.length > 0 && (
              <>
                <SectionHeader title="Most Purchased" colors={colors} />
                <Card colors={colors}>
                  {data.stats.topItems.map((item, idx) => (
                    <PurchaseRow key={item.name + idx} label={item.name} value={`×${item.qty}`} sub={fmt(item.spend)} colors={colors} />
                  ))}
                </Card>
              </>
            )}

            {allDocs.length > 0 && (
              <>
                <SectionHeader title="Purchase History" colors={colors} />
                <Card colors={colors}>
                  {allDocs.map((doc, idx) => {
                    const typeColor = doc.type === "Order" ? "#7c3aed" : doc.type === "Invoice" ? "#0072C4" : "#16a34a";
                    const typeBg = doc.type === "Order" ? "#7c3aed15" : doc.type === "Invoice" ? "#0072C415" : "#16a34a15";
                    return (
                      <View
                        key={doc.type + doc.id}
                        style={[
                          ph.row,
                          idx < allDocs.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
                        ]}
                      >
                        <View style={[ph.typeTag, { backgroundColor: typeBg }]}>
                          <Text style={[ph.typeText, { color: typeColor }]}>{doc.type}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[ph.num, { color: colors.text }]}>{doc.number}</Text>
                          <Text style={[ph.date, { color: colors.textSecondary }]}>{new Date(doc.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[ph.total, { color: colors.text }]}>{fmt(doc.total)}</Text>
                          <Text style={[ph.status, { color: statusColor(doc.status) }]}>{doc.status}</Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
const dm = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  hero: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  heroName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  syncedBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  syncedText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  loyaltyCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 16 },
  pointsText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center" },
  notes: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, paddingVertical: 14 },
});
const ph = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  typeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  num: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  total: { fontSize: 13, fontFamily: "Inter_700Bold" },
  status: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1, textTransform: "capitalize" },
});

export default function CustomersScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const qc = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState<TierFilter>("All");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { data: customers = [], isLoading, refetch } = useQuery<CustomerSummary[]>({
    queryKey: ["customers"],
    queryFn: () => api.customers.list(),
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: () => api.customers.sync(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      Alert.alert(
        "Sync Complete",
        `${result.imported} new customer${result.imported !== 1 ? "s" : ""} imported, ${result.updated} updated from Cloud POS.`,
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Sync Failed", msg);
    },
  });

  const filtered = React.useMemo(() => {
    let list = customers;
    if (tierFilter !== "All") list = list.filter((c) => c.tier === tierFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q));
    }
    return [...list].sort((a, b) => b.totalSpend - a.totalSpend);
  }, [customers, search, tierFilter]);

  const tierCounts = React.useMemo(() => {
    const counts: Record<string, number> = { All: customers.length };
    for (const c of customers) {
      counts[c.tier] = (counts[c.tier] ?? 0) + 1;
    }
    return counts;
  }, [customers]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>Customers</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>{customers.length} total</Text>
        </View>
        <TouchableOpacity
          style={[s.syncBtn, { backgroundColor: sync.isPending ? colors.backgroundSecondary : "#0072C4" }]}
          onPress={() => sync.mutate()}
          disabled={sync.isPending}
          activeOpacity={0.8}
        >
          {sync.isPending ? (
            <ActivityIndicator size="small" color="#0072C4" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={14} color="#fff" />
              <Text style={s.syncText}>Sync</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[s.searchWrap, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Search by name, email, or phone…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tierRow}>
        {TIER_ORDER.map((t) => {
          const count = tierCounts[t] ?? 0;
          const isActive = tierFilter === t;
          const tierMeta = TIER_THRESHOLDS.find((x) => x.name === t);
          const color = tierMeta ? tierMeta.color : "#0072C4";
          const bg = tierMeta ? tierMeta.bg : "#0072C415";
          return (
            <TouchableOpacity
              key={t}
              style={[
                s.tierChip,
                isActive
                  ? { backgroundColor: t === "All" ? "#0072C4" : color, borderColor: t === "All" ? "#0072C4" : color }
                  : { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
              ]}
              onPress={() => setTierFilter(t)}
              activeOpacity={0.7}
            >
              {t !== "All" && <Text style={{ fontSize: 11 }}>{TIER_ICON[t]}</Text>}
              <Text style={[s.tierChipText, { color: isActive ? "#fff" : colors.text }]}>
                {t}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#0072C4" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", paddingHorizontal: 40 }}>
            {search || tierFilter !== "All"
              ? "No customers match your filters"
              : "No customers yet. Tap Sync to import from Cloud POS."}
          </Text>
          {!search && tierFilter === "All" && (
            <TouchableOpacity
              style={[s.syncBtn, { backgroundColor: "#0072C4", marginTop: 8 }]}
              onPress={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={14} color="#fff" />
                  <Text style={s.syncText}>Sync from Cloud POS</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <CustomerCard c={item} colors={colors} onPress={() => setSelectedId(item.id)} />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: TAB_BAR_HEIGHT + 16 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {selectedId !== null && (
        <CustomerDetailModal id={selectedId} colors={colors} onClose={() => setSelectedId(null)} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, minWidth: 60, justifyContent: "center" },
  syncText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  tierRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row", alignItems: "center" },
  tierChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tierChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
