import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

export type TapToPayStatus =
  | "idle"
  | "scanning"
  | "detected"
  | "processing"
  | "approved"
  | "cancelled"
  | "error";

export interface UseTapToPayResult {
  status: TapToPayStatus;
  isNativeNfc: boolean;
  startScan: () => Promise<boolean>;
  cancel: () => void;
  reset: () => void;
}

const isNativeIos = Platform.OS === "ios";

export function useTapToPay(): UseTapToPayResult {
  const [status, setStatus] = useState<TapToPayStatus>("idle");
  const cancelledRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const nfcManagerRef = useRef<any>(null);

  const getNfcManager = useCallback(async (): Promise<any | null> => {
    if (!isNativeIos) return null;
    try {
      const mod = require("react-native-nfc-manager");
      const manager = mod.default ?? mod.NfcManager;
      if (!manager) return null;

      const supported = await manager.isSupported();
      if (!supported) return null;

      const enabled = await manager.isEnabled();
      if (!enabled) return null;

      await manager.start();
      nfcManagerRef.current = manager;
      return manager;
    } catch {
      return null;
    }
  }, []);

  const stopSession = useCallback(() => {
    const m = nfcManagerRef.current;
    if (!m || !sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    try { m.cancelTechnologyRequest(); } catch {}
    try { m.unregisterTagEvent(); } catch {}
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setStatus("cancelled");
    stopSession();
  }, [stopSession]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setStatus("idle");
  }, []);

  const startScan = useCallback(async (): Promise<boolean> => {
    cancelledRef.current = false;
    setStatus("scanning");

    const manager = await getNfcManager();

    if (!manager) {
      return false;
    }

    try {
      const { NfcTech } = require("react-native-nfc-manager");
      sessionActiveRef.current = true;

      await manager.requestTechnology([NfcTech.IsoDep], {
        alertMessage: "Hold card near the top of iPhone",
        invalidateAfterFirstRead: true,
      });

      if (cancelledRef.current) {
        setStatus("cancelled");
        return false;
      }

      const tag = await manager.getTag();
      if (!tag) {
        setStatus("error");
        return false;
      }

      setStatus("detected");
      await new Promise((r) => setTimeout(r, 350));

      if (cancelledRef.current) {
        setStatus("cancelled");
        return false;
      }

      setStatus("processing");
      await new Promise((r) => setTimeout(r, 900));

      if (cancelledRef.current) {
        setStatus("cancelled");
        return false;
      }

      setStatus("approved");
      return true;
    } catch (err: any) {
      if (cancelledRef.current) {
        setStatus("cancelled");
        return false;
      }
      const msg = String(err?.message ?? err ?? "");
      const isCancel =
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("usercancel") ||
        msg.toLowerCase().includes("session invalidated");
      setStatus(isCancel ? "cancelled" : "error");
      return false;
    } finally {
      stopSession();
    }
  }, [getNfcManager, stopSession]);

  return {
    status,
    isNativeNfc: isNativeIos,
    startScan,
    cancel,
    reset,
  };
}
