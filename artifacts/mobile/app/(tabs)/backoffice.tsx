import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { useSettings, type IndustryMode } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import BackButton from "@/components/BackButton";

const BACK_OFFICE_URL = "https://cloud-po-s-wilcoxisaac.replit.app";
const POLL_INTERVAL_MS = 8_000;
const STALE_THRESHOLD_MS = 45_000;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://mobile-pos-nexus.replit.app";

const VALID_INDUSTRIES: IndustryMode[] = ["restaurant", "retail", "service"];

function normalizeIndustry(raw: string): IndustryMode | null {
  if (raw === "services") return "service";
  if (VALID_INDUSTRIES.includes(raw as IndustryMode)) return raw as IndustryMode;
  return null;
}

function buildInjectionScript(apiBase: string): string {
  return `
(function() {
  'use strict';
  var SYNC_KEY = 'mobilePOSSync_v2';
  var DB_NAME = 'cloud-pos-offline';
  var STORE_NAME = 'transactions';

  function openDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  function getAllTxns(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var req = store.getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function() { resolve([]); };
    });
  }

  function putTxns(db, records) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      records.forEach(function(r) { store.put(r); });
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  }

  function mapOrder(order) {
    var method = order.paymentMethod === 'cash' ? 'cash'
               : order.paymentMethod === 'card' ? 'card'
               : 'digital';
    var ts = order.paidAt || order.updatedAt || new Date().toISOString();
    return {
      id: 'MOB-' + order.id + '-' + new Date(ts).getTime(),
      items: (order.items || []).map(function(i) {
        return {
          id: String(i.productId || i.id),
          name: i.productName,
          price: parseFloat(i.productPrice) || 0,
          qty: i.quantity || 1,
          tax: true
        };
      }),
      subtotal: parseFloat(order.subtotal) || 0,
      discount: 0,
      tax: parseFloat(order.tax) || 0,
      tip: 0,
      total: parseFloat(order.total) || 0,
      payment_method: method,
      amount_paid: parseFloat(order.amountTendered) || parseFloat(order.total) || 0,
      change: parseFloat(order.changeDue) || 0,
      customer: order.customerName
        ? { id: 'mob-cust', name: order.customerName }
        : null,
      tableId: order.tableNumber || null,
      timestamp: ts,
      employee: 'Mobile POS',
      source: 'mobile_pos'
    };
  }

  async function sync() {
    var already = sessionStorage.getItem(SYNC_KEY);
    if (already === 'done') return;

    try {
      var resp = await fetch('${apiBase}/api/orders?status=paid', {
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) return;
      var data = await resp.json();
      var orders = Array.isArray(data) ? data : (data.orders || []);

      if (!orders.length) {
        sessionStorage.setItem(SYNC_KEY, 'done');
        return;
      }

      var db = await openDB();
      var existing = await getAllTxns(db);
      var existingIds = new Set(existing.map(function(t) { return t.id; }));

      var toInsert = orders
        .filter(function(o) { return !(o.notes && o.notes.indexOf('synced_from:') === 0); })
        .map(mapOrder)
        .filter(function(t) { return !existingIds.has(t.id); });

      if (toInsert.length > 0) {
        await putTxns(db, toInsert);
        sessionStorage.setItem(SYNC_KEY, 'done');
        window.location.reload();
      } else {
        sessionStorage.setItem(SYNC_KEY, 'done');
      }
    } catch(e) {
      console.warn('[MobileSync] failed:', e);
    }
  }

  sync();
  true;
})();
`;
}

export default function BackOfficeScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const { settings, setIndustry } = useSettings();
  const industryRef = useRef(settings.industry);
  const prevIndustryRef = useRef(settings.industry);
  const [reloadKey, setReloadKey] = useState(0);
  const lastLoadedAt = useRef<number>(0);

  useEffect(() => {
    industryRef.current = settings.industry;
  }, [settings.industry]);

  function reload() {
    setError(false);
    setLoading(true);
    lastLoadedAt.current = Date.now();
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    if (settings.industry !== prevIndustryRef.current) {
      prevIndustryRef.current = settings.industry;
      setTimeout(reload, 300);
    }
  }, [settings.industry]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const stale = Date.now() - lastLoadedAt.current > STALE_THRESHOLD_MS;
      if (stale || error) reload();

      async function pollSettings() {
        try {
          const s = await api.settings.get();
          if (!active) return;
          const mapped = normalizeIndustry(s.industry);
          if (mapped && mapped !== industryRef.current) {
            industryRef.current = mapped;
            await setIndustry(mapped);
          }
        } catch {
        }
      }

      const interval = setInterval(pollSettings, POLL_INTERVAL_MS);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [error, setIndustry])
  );

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ paddingHorizontal: 20, paddingTop: topPad + 4 }}>
          <BackButton colors={colors} />
        </View>
        <View style={[styles.header, { paddingTop: 8, backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            Back Office
          </Text>
          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: colors.accent + "15" }]}
            onPress={reload}
          >
            <Feather name="refresh-cw" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>
        <View style={[styles.syncBanner, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}>
          <Feather name="link" size={13} color={colors.accent} />
          <Text style={[styles.syncText, { color: colors.accent, fontFamily: "Inter_500Medium" }]}>
            Synced · {settings.industry.charAt(0).toUpperCase() + settings.industry.slice(1)} mode
            {" · "}Data shared live
          </Text>
        </View>
        <View style={styles.webContainer}>
          {loading && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading back office…
              </Text>
            </View>
          )}
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={BACK_OFFICE_URL}
            style={{ width: "100%", height: "100%", border: "none", flex: 1 } as any}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            title="Cloud POS Back Office"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </View>
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  const injectionScript = buildInjectionScript(API_BASE);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: 20, paddingTop: topPad + 4 }}>
        <BackButton colors={colors} />
      </View>
      <View style={[styles.header, { paddingTop: 8, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
          Back Office
        </Text>
        <TouchableOpacity
          style={[styles.reloadBtn, { backgroundColor: colors.accent + "15" }]}
          onPress={reload}
        >
          <Feather name="refresh-cw" size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>
      <View style={[styles.syncBanner, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}>
        <Feather name="link" size={13} color={colors.accent} />
        <Text style={[styles.syncText, { color: colors.accent, fontFamily: "Inter_500Medium" }]}>
          Synced · {settings.industry.charAt(0).toUpperCase() + settings.industry.slice(1)} mode
          {" · "}Data shared live
        </Text>
      </View>
      <View style={styles.webContainer}>
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading back office…
            </Text>
          </View>
        )}
        {error ? (
          <View style={[styles.errorState, { backgroundColor: colors.background }]}>
            <Feather name="wifi-off" size={48} color={colors.textSecondary} />
            <Text style={[styles.errorTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
              Could not load back office
            </Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              Check your connection and try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              onPress={reload}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            key={reloadKey}
            source={{ uri: BACK_OFFICE_URL }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState={false}
            injectedJavaScript={injectionScript}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, letterSpacing: -0.5 },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncText: { fontSize: 12, flex: 1 },
  webContainer: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingText: { fontSize: 14 },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  errorTitle: { fontSize: 18, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
