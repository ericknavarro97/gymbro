"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { WarmupProtocol, WeightUnit } from "@/server/domain";
import type { WeakPointView } from "@/server/services/views";
import type { SessionStore } from "./session-store";

export interface SessionContextValue {
  store: SessionStore;
  workoutLogId: string;
  /** User's default unit; each exercise card may use its own (store.getItemUnit). */
  unit: WeightUnit;
  /** Warm-up rounding step per unit (Perfil). */
  rounding: Record<WeightUnit, number>;
  protocol: WarmupProtocol;
  isDeload: boolean;
  needsWeakPoint: boolean;
  weakPoint: WeakPointView | null;
}

const Ctx = createContext<SessionContextValue | null>(null);

export const SessionProvider = Ctx.Provider;

export function useSession(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}

/** Subscribe to a slice of the session store (selector must return a stable value). */
export function useStore<T>(select: (store: SessionStore) => T): T {
  const { store } = useSession();
  const get = () => select(store);
  return useSyncExternalStore(store.subscribe, get, get);
}
