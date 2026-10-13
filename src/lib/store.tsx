"use client";

import { MotionConfig } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { chainSource, liveAvailable, setSigner } from "./chain-source";
import { DEMO_ACCOUNT, demoSource } from "./demo-source";
import {
  createPasskeyAccount,
  forgetPasskey,
  hasRememberedPasskey,
  passkeyErrorMessage,
  unlockPasskeyAccount,
  type PasskeyAccount,
} from "./mera";
import type { Address, DataSource, TxResult } from "./types";

type Mode = "demo" | "live";

type Store = {
  mode: Mode;
  liveAvailable: boolean;
  setMode: (mode: Mode) => void;
  source: DataSource;
  /** The unlocked passkey account; in the sandbox, a simulated wallet when none is unlocked. */
  account: Address | null;
  /** Address of the unlocked Mera passkey account, if any. */
  passkey: Address | null;
  /** True when this browser has used a passkey here before. */
  remembered: boolean;
  /** Unlock the remembered passkey, or create a new passkey account if there is none. */
  connect: () => Promise<void>;
  /** Pick any existing DropOwn passkey on this device. */
  useExistingPasskey: () => Promise<void>;
  createPasskey: () => Promise<void>;
  /** End the signing session and zero the in-memory key. */
  lock: () => void;
  /** Lock and forget which passkey this browser used. */
  forget: () => void;
  connecting: boolean;
  walletError: string | null;
  /** Bumps whenever data may have changed. */
  tick: number;
  refresh: () => void;
};

const StoreContext = createContext<Store | null>(null);
const MODE_KEY = "dropown.mode";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(liveAvailable ? "live" : "demo");
  const [passkey, setPasskey] = useState<Address | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const session = useRef<PasskeyAccount | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    // Restoring browser-only state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemembered(hasRememberedPasskey());
    if (!liveAvailable) return;
    try {
      if (window.localStorage.getItem(MODE_KEY) === "demo") setModeState("demo");
    } catch {
      // No storage: keep the default.
    }
  }, []);

  const setMode = useCallback((next: Mode) => {
    if (next === "live" && !liveAvailable) return;
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Preference just won't persist.
    }
  }, []);

  const lock = useCallback(() => {
    session.current?.lock();
    session.current = null;
    setSigner(null);
    setPasskey(null);
  }, []);

  // Zero the key if the provider ever unmounts.
  useEffect(() => lock, [lock]);

  const open = useCallback(
    async (start: () => Promise<PasskeyAccount>) => {
      setConnecting(true);
      setWalletError(null);
      try {
        const next = await start();
        session.current?.lock();
        session.current = next;
        setSigner(next.account);
        setPasskey(next.account.address);
        setRemembered(true);
        refresh();
      } catch (e) {
        setWalletError(passkeyErrorMessage(e));
      } finally {
        setConnecting(false);
      }
    },
    [refresh],
  );

  const createPasskey = useCallback(() => open(createPasskeyAccount), [open]);
  const useExistingPasskey = useCallback(() => open(unlockPasskeyAccount), [open]);
  const connect = useCallback(
    () => open(hasRememberedPasskey() ? unlockPasskeyAccount : createPasskeyAccount),
    [open],
  );

  const forget = useCallback(() => {
    lock();
    forgetPasskey();
    setRemembered(false);
  }, [lock]);

  const value = useMemo<Store>(
    () => ({
      mode,
      liveAvailable,
      setMode,
      source: mode === "live" ? chainSource : demoSource,
      account: passkey ?? (mode === "live" ? null : DEMO_ACCOUNT),
      passkey,
      remembered,
      connect,
      useExistingPasskey,
      createPasskey,
      lock,
      forget,
      connecting,
      walletError,
      tick,
      refresh,
    }),
    [mode, setMode, passkey, remembered, connect, useExistingPasskey, createPasskey, lock, forget, connecting, walletError, tick, refresh],
  );

  return (
    <StoreContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

const INTERRUPTED = "Something interrupted the drop — try again.";

/** Turn whatever went wrong into a sentence a fan can act on. Technical detail stays in the console. */
function messageOf(e: unknown): string {
  if (!e || typeof e !== "object") return INTERRUPTED;
  const err = e as { name?: string; shortMessage?: string; message?: string };
  // The sandbox and the passkey layer already speak plainly.
  if (err.name === "DemoError" || err.name === "PlainError") return err.message ?? INTERRUPTED;

  const text = `${err.shortMessage ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (text.includes("insufficient funds") || text.includes("exceeds the balance")) {
    return "Your account needs a little testnet MON for this. Top it up from the faucet in the account menu, then try again.";
  }
  if (text.includes("unlock your passkey")) return "Unlock your passkey account to continue.";
  if (text.includes("campaignclosed")) return "This drop has closed to new backers.";
  if (text.includes("alreadyvoted")) return "You've already voted on this one.";
  if (text.includes("codetaken")) return "That referral code is taken. Try another.";
  if (text.includes("nothingtoclaim")) return "There's nothing to claim yet.";
  if (text.includes("fetch") || text.includes("network") || text.includes("timeout") || text.includes("http request")) {
    return "We couldn't reach Monad Testnet. Check your connection and try again.";
  }
  console.error(e);
  return INTERRUPTED;
}

/** Load data from the active source; reloads on refresh, mode change, and (live) every 12s. */
export function useLoad<T>(load: (source: DataSource) => Promise<T>, deps: unknown[]) {
  const { source, tick, mode } = useStore();
  const [state, setState] = useState<{ data?: T; error: string | null; loading: boolean }>({
    error: null,
    loading: true,
  });
  const [poll, setPoll] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (mode !== "live") return;
    const timer = setInterval(() => setPoll((p) => p + 1), 12_000);
    return () => clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current(source)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e) => !cancelled && setState((s) => ({ ...s, error: messageOf(e), loading: false })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, tick, poll, ...deps]);

  return state;
}

export type ActionState = {
  pending: string | null;
  error: string | null;
  notice: { text: string; result: TxResult } | null;
};

/** Run a write against the active source with pending / success / error state. */
export function useAction() {
  const { refresh } = useStore();
  const [state, setState] = useState<ActionState>({ pending: null, error: null, notice: null });

  const run = useCallback(
    async <T extends TxResult>(key: string, fn: () => Promise<T>, success: string): Promise<T | null> => {
      setState({ pending: key, error: null, notice: null });
      try {
        const result = await fn();
        setState({ pending: null, error: null, notice: { text: success, result } });
        refresh();
        return result;
      } catch (e) {
        setState({ pending: null, error: messageOf(e), notice: null });
        return null;
      }
    },
    [refresh],
  );

  const fail = useCallback((error: string) => setState({ pending: null, error, notice: null }), []);

  return { ...state, run, fail };
}

/** Current unix time in seconds, ticking once a second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
