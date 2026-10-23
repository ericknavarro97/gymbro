/**
 * Client-side state for the logging screen (/sesion/[id]).
 *
 * An external store (read with useSyncExternalStore) so each set row only
 * re-renders when its own slice changes, and so autosave timers, retries and
 * localStorage drafts live outside React's render cycle.
 *
 * Autosave per set:
 *  - every edit marks the row "pending", writes a draft to localStorage and
 *    schedules a debounced save; blur flushes immediately;
 *  - a failed request (network / INTERNAL) keeps the draft and marks the row
 *    "offline"; offline rows retry with backoff, on `online` and when the tab
 *    becomes visible again;
 *  - drafts are restored (and re-sent) when the screen mounts.
 */
import type { WeightUnit } from "@/server/domain";
import type { ActionResult } from "@/server/actions/result";
import type { SaveSetResult } from "@/server/services/workout.service";
import type { SessionItem, SetView } from "@/server/services/views";
import type { SaveSetInput } from "@/server/services/validation";
import { parseDecimal } from "@/components/ui/number";
import { maxSetsOf, normalizeRpe, segmentsOf, weightToInput } from "./format";

export interface RowValues {
  weight: string;
  reps: string;
  rpe: string;
  /** One entry per segment for segmented schemes, else []. */
  segments: string[];
}

export type RowState = "idle" | "pending" | "saving" | "saved" | "error" | "offline";

export interface RowSnapshot {
  values: RowValues;
  state: RowState;
  message?: string;
  /** Last value confirmed by the server for this set. */
  saved: SetView | null;
}

export interface TimerSnapshot {
  endsAt: number;
  totalSec: number;
  label: string;
}

type Listener = () => void;

export type SaveSetFn = (input: SaveSetInput) => Promise<ActionResult<SaveSetResult>>;

interface DraftEntry {
  prescriptionId: number;
  setNumber: number;
  values: RowValues;
  /** Unit the weight was typed in (older drafts: the item's current unit). */
  unit?: WeightUnit;
  ts: number;
}

const DRAFT_PREFIX = "gb-session-draft:";
const TIMER_PREF_KEY = "gb-rest-timer";
const DEBOUNCE_MS = 900;
const RETRY_MIN_MS = 4000;
const RETRY_MAX_MS = 30000;

export const rowKey = (prescriptionId: number, setNumber: number) => `${prescriptionId}:${setNumber}`;

function emptyValues(segments: number): RowValues {
  return { weight: "", reps: "", rpe: "", segments: segments > 1 ? Array.from({ length: segments }, () => "") : [] };
}

function valuesFromSet(s: SetView | null, segments: number, unit: WeightUnit): RowValues {
  if (!s) return emptyValues(segments);
  const seg =
    segments > 1
      ? Array.from({ length: segments }, (_, i) => (s.segmentReps?.[i] !== undefined ? String(s.segmentReps[i]) : ""))
      : [];
  return {
    weight: weightToInput(s.weight, s.unit, unit),
    reps: segments > 1 ? "" : s.reps !== null ? String(s.reps) : "",
    rpe: s.rpe !== null ? String(s.rpe) : "",
    segments: seg,
  };
}

/** Replace the typed RPE with the stored one when they differ numerically (keeps "8." while typing). */
function withSavedRpe(v: RowValues, saved: SetView | null): RowValues {
  if (!saved || saved.rpe === null || v.rpe.trim() === "") return v;
  const typed = parseDecimal(v.rpe);
  return typed === saved.rpe ? v : { ...v, rpe: String(saved.rpe) };
}

const isEmpty = (v: RowValues) =>
  v.weight.trim() === "" && v.reps.trim() === "" && v.rpe.trim() === "" && v.segments.every((x) => x.trim() === "");

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** A set counts as logged when it has reps (or segment reps) or a weight. */
export const isLoggedSet = (s: SetView | null) =>
  s !== null && (s.reps !== null || s.weight !== null || (s.segmentReps?.length ?? 0) > 0);

/** Weak point slot whose current weak point offers no exercises (or none chosen yet). */
export const isWeakSlotWithoutOptions = (item: SessionItem) => item.slot !== "exercise" && item.choices.length === 0;

/** true when this session already has something logged for the item (exercise log or sets). */
export const hasLoggedWork = (item: SessionItem) => item.exerciseLogId !== null || item.sets.length > 0;

/**
 * true for a weak point slot that only shows guidance: no options and nothing
 * logged yet. Once something was logged (e.g. before the weak point changed
 * to a guidance-only one) the sets stay visible and editable.
 */
export const isGuidanceOnlyItem = (item: SessionItem) => isWeakSlotWithoutOptions(item) && !hasLoggedWork(item);

/**
 * false for slots with nothing to log (see isGuidanceOnlyItem). They don't
 * count toward progress and never become the "current" card.
 */
export const isLoggableItem = (item: SessionItem) =>
  !isGuidanceOnlyItem(item) && Boolean(item.performedExercise ?? item.exercise);

/** First unit found among sets that carry a weight. */
const unitOfSets = (sets: readonly SetView[] | undefined) => sets?.find((s) => s.weight !== null)?.unit ?? null;

export class SessionStore {
  readonly workoutLogId: string;
  /** User's default unit (Perfil); each exercise may use its own (see itemUnits). */
  readonly unit: WeightUnit;
  private items: SessionItem[];
  private rows = new Map<string, RowSnapshot>();
  /**
   * Unit the weights of each prescription are typed in. Gyms mix lb and kg
   * equipment, so it's chosen per exercise and defaults to the unit used last
   * time for that exercise (this session's sets, then last performance).
   */
  private itemUnits = new Map<number, WeightUnit>();
  private rowCounts = new Map<number, number>();
  private listeners = new Set<Listener>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inflight = new Set<string>();
  private again = new Set<string>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = RETRY_MIN_MS;
  private progress = "0/0";
  private unsaved = 0;
  private timer: TimerSnapshot | null = null;
  private timerEnabled = true;
  private attached = false;
  private waiters: Array<() => void> = [];

  constructor(
    opts: { workoutLogId: string; unit: WeightUnit; items: SessionItem[] },
    private readonly save: SaveSetFn,
  ) {
    this.workoutLogId = opts.workoutLogId;
    this.unit = opts.unit;
    this.items = opts.items;
    for (const item of opts.items) this.initItemRows(item);
    this.recompute();
  }

  // ---------------------------------------------------------------- subscription

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    this.recompute();
    for (const l of this.listeners) l();
  }

  // ---------------------------------------------------------------- snapshots

  getItems = () => this.items;
  getRow = (key: string): RowSnapshot | undefined => this.rows.get(key);
  getRowCount = (prescriptionId: number) => this.rowCounts.get(prescriptionId) ?? 0;
  getItemUnit = (prescriptionId: number): WeightUnit => this.itemUnits.get(prescriptionId) ?? this.unit;
  /** "done/total" exercises fully logged (primitive → stable snapshot). */
  getProgress = () => this.progress;
  getUnsavedCount = () => this.unsaved;
  getTimer = () => this.timer;
  getTimerEnabled = () => this.timerEnabled;

  private item(prescriptionId: number) {
    return this.items.find((i) => i.id === prescriptionId);
  }

  private defaultUnitFor(item: SessionItem): WeightUnit {
    return unitOfSets(item.sets) ?? unitOfSets(item.lastPerformance?.sets) ?? this.unit;
  }

  /** true when any row of the item holds a saved set or typed values. */
  private itemHasData(item: SessionItem) {
    for (let n = 1; n <= maxSetsOf(item); n++) {
      const r = this.rows.get(rowKey(item.id, n));
      if (r && (r.saved || !isEmpty(r.values))) return true;
    }
    return false;
  }

  private initItemRows(item: SessionItem, keepUnsaved = false) {
    const segs = segmentsOf(item);
    const max = maxSetsOf(item);
    // A substitution keeps the unit already in use; otherwise follow the new exercise's history.
    if (!keepUnsaved || !this.itemUnits.has(item.id) || !this.itemHasData(item)) {
      this.itemUnits.set(item.id, this.defaultUnitFor(item));
    }
    const unit = this.getItemUnit(item.id);
    const savedMax = item.sets.reduce((m, s) => Math.max(m, s.setNumber), 0);
    const prevCount = this.rowCounts.get(item.id) ?? 0;
    this.rowCounts.set(item.id, Math.min(max, Math.max(item.workingSets, savedMax, prevCount)));
    for (let n = 1; n <= max; n++) {
      const key = rowKey(item.id, n);
      const saved = item.sets.find((s) => s.setNumber === n) ?? null;
      const prev = this.rows.get(key);
      if (keepUnsaved && prev && (prev.state === "pending" || prev.state === "saving" || prev.state === "offline")) {
        this.rows.set(key, { ...prev, saved });
        continue;
      }
      this.rows.set(key, { values: valuesFromSet(saved, segs, unit), state: saved ? "saved" : "idle", saved });
    }
  }

  private recompute() {
    let done = 0;
    let total = 0;
    let unsaved = 0;
    for (const item of this.items) {
      if (!isLoggableItem(item)) continue;
      let logged = 0;
      for (let n = 1; n <= item.workingSets; n++) if (isLoggedSet(this.rows.get(rowKey(item.id, n))?.saved ?? null)) logged++;
      const any = item.sets.length > 0 || logged > 0;
      if (!item.isOptional || any) total++;
      if (item.workingSets > 0 && logged >= item.workingSets) done++;
    }
    for (const r of this.rows.values()) if (r.state === "offline" || r.state === "error") unsaved++;
    this.progress = `${done}/${total}`;
    this.unsaved = unsaved;
  }

  private setRow(key: string, patch: Partial<RowSnapshot>) {
    const prev = this.rows.get(key);
    if (!prev) return;
    this.rows.set(key, { ...prev, ...patch });
  }

  // ---------------------------------------------------------------- lifecycle

  /** Call once on mount (client only): restore drafts, listeners, prefs. */
  attach() {
    if (this.attached) return;
    this.attached = true;
    const ls = safeStorage();
    try {
      this.timerEnabled = ls?.getItem(TIMER_PREF_KEY) !== "off";
    } catch {
      /* ignore */
    }
    window.addEventListener("online", this.retryAll);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.restoreDrafts();
    this.emit();
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("online", this.retryAll);
    document.removeEventListener("visibilitychange", this.onVisibility);
    // Don't drop debounced edits when leaving the screen: send them now.
    const pending = [...this.timers.entries()];
    this.timers.clear();
    for (const [key, t] of pending) {
      clearTimeout(t);
      void this.send(key, false);
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible") this.retryAll();
  };

  // ---------------------------------------------------------------- drafts

  private draftKey() {
    return `${DRAFT_PREFIX}${this.workoutLogId}`;
  }

  private readDrafts(): Record<string, DraftEntry> {
    const ls = safeStorage();
    if (!ls) return {};
    try {
      const raw = ls.getItem(this.draftKey());
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, DraftEntry>) : {};
    } catch {
      return {};
    }
  }

  private writeDrafts(d: Record<string, DraftEntry>) {
    const ls = safeStorage();
    if (!ls) return;
    try {
      if (Object.keys(d).length === 0) ls.removeItem(this.draftKey());
      else ls.setItem(this.draftKey(), JSON.stringify(d));
    } catch {
      /* quota / private mode: drafts are best effort */
    }
  }

  private putDraft(key: string) {
    const row = this.rows.get(key);
    if (!row) return;
    const [pid, n] = key.split(":").map(Number);
    const d = this.readDrafts();
    d[key] = { prescriptionId: pid, setNumber: n, values: row.values, unit: this.getItemUnit(pid), ts: Date.now() };
    this.writeDrafts(d);
  }

  private dropDraft(key: string) {
    const d = this.readDrafts();
    if (key in d) {
      delete d[key];
      this.writeDrafts(d);
    }
  }

  private restoreDrafts() {
    const drafts = this.readDrafts();
    let restored = 0;
    for (const [key, entry] of Object.entries(drafts)) {
      const item = this.item(entry.prescriptionId);
      const row = this.rows.get(key);
      if (!item || !row || !entry.values) {
        this.dropDraft(key);
        continue;
      }
      const segs = segmentsOf(item);
      // The draft is the latest intent: the weight stays as typed, in the unit it was typed in.
      if (entry.unit) this.itemUnits.set(item.id, entry.unit);
      const values: RowValues = {
        weight: String(entry.values.weight ?? ""),
        reps: String(entry.values.reps ?? ""),
        rpe: String(entry.values.rpe ?? ""),
        segments:
          segs > 1 ? Array.from({ length: segs }, (_, i) => String(entry.values.segments?.[i] ?? "")) : [],
      };
      this.rows.set(key, { ...row, values, state: "pending", message: undefined });
      this.rowCounts.set(item.id, Math.max(this.getRowCount(item.id), entry.setNumber));
      restored++;
      void this.send(key, false);
    }
    return restored;
  }

  // ---------------------------------------------------------------- editing

  setValues(prescriptionId: number, setNumber: number, patch: Partial<RowValues>) {
    const key = rowKey(prescriptionId, setNumber);
    const row = this.rows.get(key);
    if (!row) return;
    const values = { ...row.values, ...patch };
    this.rows.set(key, { ...row, values, state: "pending", message: undefined });
    this.putDraft(key);
    this.schedule(key, DEBOUNCE_MS);
    this.emit();
  }

  /** Blur: save now if there is something pending. */
  flush(prescriptionId: number, setNumber: number) {
    const key = rowKey(prescriptionId, setNumber);
    if (this.rows.get(key)?.state !== "pending") return;
    this.schedule(key, 0);
  }

  /**
   * Switch the unit the weights of one exercise are typed in. Typed numbers are
   * relabelled, not converted (they're what the plates/dumbbells say), and rows
   * that already hold a weight are re-saved with the new unit.
   */
  setItemUnit(prescriptionId: number, unit: WeightUnit) {
    const item = this.item(prescriptionId);
    if (!item || this.getItemUnit(prescriptionId) === unit) return;
    this.itemUnits.set(prescriptionId, unit);
    for (let n = 1; n <= maxSetsOf(item); n++) {
      const key = rowKey(prescriptionId, n);
      const row = this.rows.get(key);
      if (!row || row.values.weight.trim() === "") continue;
      this.setRow(key, { state: "pending", message: undefined });
      this.putDraft(key);
      this.schedule(key, 0);
    }
    this.emit();
  }

  addRow(prescriptionId: number) {
    const item = this.item(prescriptionId);
    if (!item) return;
    const n = Math.min(maxSetsOf(item), this.getRowCount(prescriptionId) + 1);
    this.rowCounts.set(prescriptionId, n);
    this.emit();
  }

  /** Remove the last extra (beyond workingSets) row when it holds nothing. */
  removeRow(prescriptionId: number) {
    const item = this.item(prescriptionId);
    const count = this.getRowCount(prescriptionId);
    if (!item || count <= item.workingSets) return;
    const row = this.rows.get(rowKey(prescriptionId, count));
    if (row && (row.saved || !isEmpty(row.values))) return;
    this.rowCounts.set(prescriptionId, count - 1);
    this.emit();
  }

  /** Replace an item after chooseExercise (keeps rows with unsaved edits). */
  replaceItem(next: SessionItem) {
    this.items = this.items.map((i) => (i.id === next.id ? next : i));
    this.initItemRows(next, true);
    this.emit();
  }

  // ---------------------------------------------------------------- saving

  private schedule(key: string, delay: number) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.send(key, true);
      }, delay),
    );
  }

  private buildInput(item: SessionItem, setNumber: number, v: RowValues): SaveSetInput | { error: string } {
    const weight = v.weight.trim() === "" ? null : parseDecimal(v.weight);
    if (v.weight.trim() !== "" && weight === null) return { error: "Peso inválido" };
    if (weight !== null && weight > 2000) return { error: "Peso demasiado alto" };
    const rpeRaw = v.rpe.trim() === "" ? null : parseDecimal(v.rpe);
    if (v.rpe.trim() !== "" && rpeRaw === null) return { error: "RPE inválido" };
    if (rpeRaw !== null && rpeRaw > 10) return { error: "El RPE va de 0 a 10" };
    const rpe = rpeRaw === null ? null : normalizeRpe(rpeRaw);
    const segs = segmentsOf(item);
    let reps: number | null = null;
    let segmentReps: number[] | null = null;
    if (segs > 1) {
      // Only the filled phases are saved (a blank phase is "not done", not 0 reps):
      // trailing blanks are dropped, a blank before a filled phase is an error.
      const texts = v.segments.map((s) => s.trim());
      let len = texts.length;
      while (len > 0 && texts[len - 1] === "") len--;
      if (len > 0) {
        const gap = texts.slice(0, len).findIndex((t) => t === "");
        if (gap !== -1) return { error: `Completa la fase ${gap + 1}` };
        segmentReps = texts.slice(0, len).map((t) => Number.parseInt(t, 10));
        if (segmentReps.some((r) => !Number.isFinite(r))) return { error: "Reps inválidas" };
      }
    } else if (v.reps.trim() !== "") {
      reps = Number.parseInt(v.reps, 10);
      if (!Number.isFinite(reps)) return { error: "Reps inválidas" };
    }
    if ((reps ?? 0) > 200 || (segmentReps ?? []).some((r) => r > 200)) return { error: "Demasiadas reps" };
    return {
      workoutLogId: this.workoutLogId,
      prescriptionId: item.id,
      setNumber,
      weight,
      unit: this.getItemUnit(item.id),
      reps,
      rpe,
      segmentReps,
    };
  }

  private async send(key: string, userInitiated: boolean): Promise<void> {
    const row = this.rows.get(key);
    if (!row) return;
    if (this.inflight.has(key)) {
      this.again.add(key);
      return;
    }
    const [pid, n] = key.split(":").map(Number);
    const item = this.item(pid);
    if (!item) return;
    const sentValues = row.values;
    if (isEmpty(sentValues) && !row.saved) {
      this.setRow(key, { state: "idle", message: undefined });
      this.dropDraft(key);
      this.emit();
      this.notifyIdle();
      return;
    }
    const input = this.buildInput(item, n, sentValues);
    if ("error" in input) {
      this.setRow(key, { state: "error", message: input.error });
      this.emit();
      this.notifyIdle();
      return;
    }

    this.inflight.add(key);
    this.setRow(key, { state: "saving", message: undefined });
    this.emit();
    const prevSaved = row.saved;
    let r: ActionResult<SaveSetResult> | null = null;
    try {
      r = await this.save(input);
    } catch {
      r = null;
    }
    this.inflight.delete(key);

    const current = this.rows.get(key);
    if (!current) return;
    const changedMeanwhile = current.values !== sentValues;

    if (r === null || (!r.ok && r.error.code === "INTERNAL")) {
      // Network failure / server hiccup → keep a draft and retry later.
      this.putDraft(key);
      this.setRow(key, { state: changedMeanwhile ? "pending" : "offline", message: "Sin guardar" });
      this.scheduleRetry();
    } else if (!r.ok) {
      this.dropDraft(key);
      const msg = r.error.fieldErrors ? Object.values(r.error.fieldErrors)[0]?.[0] : undefined;
      this.setRow(key, { state: "error", message: msg ?? r.error.message });
    } else {
      const saved = r.data.set;
      if (!changedMeanwhile) this.dropDraft(key);
      this.setRow(key, {
        saved,
        state: changedMeanwhile ? "pending" : saved ? "saved" : "idle",
        message: undefined,
        // RPE is stored in 0.5 steps: show the stored value (8.3 → 8.5) so input and DB agree.
        ...(changedMeanwhile ? {} : { values: withSavedRpe(sentValues, saved) }),
      });
      this.items = this.items.map((i) =>
        i.id === pid
          ? {
              ...i,
              exerciseLogId: r.data.exerciseLogId,
              performedIsDefault: false,
              sets: saved
                ? [...i.sets.filter((s) => s.setNumber !== n), saved].sort((a, b) => a.setNumber - b.setNumber)
                : i.sets.filter((s) => s.setNumber !== n),
            }
          : i,
      );
      this.retryDelay = RETRY_MIN_MS;
      const becameLogged = saved && (saved.reps !== null || (saved.segmentReps?.length ?? 0) > 0) &&
        !(prevSaved && (prevSaved.reps !== null || (prevSaved.segmentReps?.length ?? 0) > 0));
      if (userInitiated && becameLogged) this.startRest(item);
    }
    this.emit();
    if (changedMeanwhile || this.again.has(key)) {
      this.again.delete(key);
      this.schedule(key, changedMeanwhile ? DEBOUNCE_MS : 0);
    }
    this.notifyIdle();
  }

  private scheduleRetry() {
    if (this.retryTimer || !this.attached) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryDelay = Math.min(RETRY_MAX_MS, this.retryDelay * 2);
      this.retryAll();
    }, this.retryDelay);
  }

  /** Re-send every offline row now. */
  retryAll = () => {
    for (const [key, row] of this.rows) if (row.state === "offline") void this.send(key, false);
  };

  private busy() {
    if (this.timers.size > 0 || this.inflight.size > 0) return true;
    for (const r of this.rows.values()) if (r.state === "pending") return true;
    return false;
  }

  private notifyIdle() {
    if (this.busy()) return;
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn();
  }

  /** Send everything pending now and wait until no save is in flight (max ~8 s). */
  async flushAll(): Promise<void> {
    for (const [key, row] of this.rows) {
      if (row.state === "pending" || row.state === "offline") this.schedule(key, 0);
    }
    if (!this.busy()) return;
    await new Promise<void>((resolve) => {
      const done = setTimeout(resolve, 8000);
      this.waiters.push(() => {
        clearTimeout(done);
        resolve();
      });
    });
  }

  // ---------------------------------------------------------------- rest timer

  setTimerEnabled(on: boolean) {
    this.timerEnabled = on;
    try {
      safeStorage()?.setItem(TIMER_PREF_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!on) this.timer = null;
    this.emit();
  }

  private startRest(item: SessionItem) {
    const sec = item.rest.maxSec;
    if (!this.timerEnabled || !sec || sec <= 0) return;
    const name = item.performedExercise?.name ?? item.exercise?.name ?? "";
    this.timer = { endsAt: Date.now() + sec * 1000, totalSec: sec, label: name };
  }

  addRestTime(sec: number) {
    if (!this.timer) return;
    const base = Math.max(this.timer.endsAt, Date.now());
    this.timer = { ...this.timer, endsAt: base + sec * 1000, totalSec: this.timer.totalSec + sec };
    this.emit();
  }

  stopRest() {
    this.timer = null;
    this.emit();
  }
}
