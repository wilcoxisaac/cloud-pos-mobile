import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";

export type IndustryMode = "restaurant" | "retail" | "service";

export type TabId =
  | "index"
  | "tables"
  | "kitchen"
  | "appointments"
  | "menu"
  | "invoices"
  | "customers"
  | "history"
  | "backoffice"
  | "settings"
  | "more";

const PRIMARY_TAB_DEFAULTS: Record<IndustryMode, TabId[]> = {
  restaurant: ["index", "tables", "menu", "customers"],
  service:    ["index", "appointments", "menu", "customers"],
  retail:     ["index", "menu", "customers", "history"],
};

const ALL_OPTIONAL_TABS: Record<IndustryMode, TabId[]> = {
  restaurant: ["index", "tables", "kitchen", "menu", "invoices", "customers", "history", "backoffice", "settings"],
  service:    ["index", "appointments", "menu", "invoices", "customers", "history", "backoffice", "settings"],
  retail:     ["index", "menu", "customers", "history", "backoffice", "settings"],
};

const TAB_PREFS_KEY = "tab_primary_prefs";

interface AppSettings {
  industry: IndustryMode;
  taxRate: string;
  defaultPaymentTerms: string;
  invoicePaymentMethods: string[];
}

interface SettingsContextValue {
  settings: AppSettings;
  industry: IndustryMode;
  isLoading: boolean;
  setIndustry: (industry: IndustryMode) => Promise<void>;
  setPaymentTerms: (days: string) => Promise<void>;
  setInvoicePaymentMethods: (methods: string[]) => Promise<void>;
  industryLabel: string;
  tableLabel: string;
  customerLabel: string;
  primaryTabs: TabId[];
  hiddenTabs: TabId[];
  availableTabs: TabId[];
  setPrimaryTabs: (tabs: TabId[]) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = { industry: "restaurant", taxRate: "8.0", defaultPaymentTerms: "30", invoicePaymentMethods: ["card"] };

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  industry: "restaurant",
  isLoading: true,
  setIndustry: async () => {},
  setPaymentTerms: async () => {},
  setInvoicePaymentMethods: async () => {},
  industryLabel: "Restaurant",
  tableLabel: "Table",
  customerLabel: "Customer",
  primaryTabs: PRIMARY_TAB_DEFAULTS.restaurant,
  hiddenTabs: [],
  availableTabs: ALL_OPTIONAL_TABS.restaurant,
  setPrimaryTabs: async () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [tabPrefs, setTabPrefs] = useState<Partial<Record<IndustryMode, TabId[]>>>({});
  const tabPrefsRef = useRef(tabPrefs);

  const loadSettings = useCallback(async () => {
    try {
      const [data, rawPrefs] = await Promise.all([
        api.settings.get(),
        AsyncStorage.getItem(TAB_PREFS_KEY),
      ]);
      setSettings({
        industry: data.industry,
        taxRate: data.taxRate,
        defaultPaymentTerms: data.defaultPaymentTerms ?? "30",
        invoicePaymentMethods: data.invoicePaymentMethods ?? ["card"],
      });
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        tabPrefsRef.current = parsed;
        setTabPrefs(parsed);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const setIndustry = useCallback(async (industry: IndustryMode) => {
    const prev = settings;
    setSettings((s) => ({ ...s, industry }));
    try {
      const updated = await api.settings.update({ industry });
      setSettings((s) => ({ ...s, industry: updated.industry, taxRate: updated.taxRate }));
    } catch {
      setSettings(prev);
    }
  }, [settings]);

  const setPaymentTerms = useCallback(async (defaultPaymentTerms: string) => {
    const prev = settings;
    setSettings((s) => ({ ...s, defaultPaymentTerms }));
    try {
      const updated = await api.settings.update({ defaultPaymentTerms });
      setSettings((s) => ({ ...s, defaultPaymentTerms: updated.defaultPaymentTerms ?? defaultPaymentTerms }));
    } catch {
      setSettings(prev);
    }
  }, [settings]);

  const setInvoicePaymentMethods = useCallback(async (invoicePaymentMethods: string[]) => {
    const prev = settings;
    setSettings((s) => ({ ...s, invoicePaymentMethods }));
    try {
      const updated = await api.settings.update({ invoicePaymentMethods });
      setSettings((s) => ({ ...s, invoicePaymentMethods: updated.invoicePaymentMethods ?? invoicePaymentMethods }));
    } catch {
      setSettings(prev);
    }
  }, [settings]);

  const setPrimaryTabs = useCallback(async (tabs: TabId[]) => {
    const updated = { ...tabPrefsRef.current, [settings.industry]: tabs };
    tabPrefsRef.current = updated;
    setTabPrefs(updated);
    try {
      await AsyncStorage.setItem(TAB_PREFS_KEY, JSON.stringify(updated));
    } catch {}
  }, [settings.industry]);

  const industryLabels: Record<IndustryMode, string> = {
    restaurant: "Restaurant",
    retail: "Retail",
    service: "Service",
  };

  const tableLabels: Record<IndustryMode, string> = {
    restaurant: "Table",
    retail: "Register",
    service: "Stylist",
  };

  const customerLabels: Record<IndustryMode, string> = {
    restaurant: "Guest",
    retail: "Customer",
    service: "Client",
  };

  const ind = settings.industry;
  const primaryTabs: TabId[] = tabPrefs[ind] ?? PRIMARY_TAB_DEFAULTS[ind];
  const availableTabs: TabId[] = ALL_OPTIONAL_TABS[ind];
  const hiddenTabs: TabId[] = availableTabs.filter((t) => !primaryTabs.includes(t));

  return (
    <SettingsContext.Provider
      value={{
        settings,
        industry: settings.industry,
        isLoading,
        setIndustry,
        setPaymentTerms,
        setInvoicePaymentMethods,
        industryLabel: industryLabels[settings.industry],
        tableLabel: tableLabels[settings.industry],
        customerLabel: customerLabels[settings.industry],
        primaryTabs,
        hiddenTabs,
        availableTabs,
        setPrimaryTabs,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
