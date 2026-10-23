/** Per-user settings. Every query is keyed by user id. */
import { eq } from "drizzle-orm";
import { db, type Transaction } from "../db/client";
import { userSettings } from "../db/schema";

export type UserSettingsRow = typeof userSettings.$inferSelect;
type Executor = typeof db | Transaction;

export async function getSettings(userId: string, tx: Executor = db): Promise<UserSettingsRow | null> {
  const [s] = await tx.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return s ?? null;
}

export interface SettingsPatch {
  weightUnit?: "lb" | "kg";
  weakPointId?: number | null;
  roundingLb?: number;
  roundingKg?: number;
}

/** Insert or merge the given fields into the user's settings row. */
export async function upsertSettings(
  userId: string,
  patch: SettingsPatch,
  tx: Executor = db,
): Promise<UserSettingsRow> {
  const values = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as SettingsPatch;
  const [row] = await tx
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: Object.keys(values).length ? { ...values, updatedAt: new Date() } : { updatedAt: new Date() },
    })
    .returning();
  return row;
}
