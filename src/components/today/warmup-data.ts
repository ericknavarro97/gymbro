/**
 * Server-only read helper for the Hoy warm-up sheet (general warm-up items +
 * specific warm-up protocol). Read-only catalog data, no user scoping needed.
 *
 * Only import this from Server Components (it touches the DB through the
 * program repository). It returns plain serializable objects for
 * <WarmupGuideButton/>.
 */
import { DEFAULT_WARMUP_PROTOCOL, type WarmupProtocol } from "@/server/domain";
import { getWarmupProtocol, listGeneralWarmup } from "@/server/repositories/program.repo";

export interface WarmupGuide {
  general: Array<{ position: number; item: string; dose: string | null }>;
  protocol: WarmupProtocol;
}

export async function getWarmupGuide(): Promise<WarmupGuide> {
  const [protocol, general] = await Promise.all([getWarmupProtocol(), listGeneralWarmup()]);
  return {
    general: general.map((g) => ({
      position: g.position,
      item: g.itemEs ?? g.item,
      dose: g.doseEs ?? g.dose,
    })),
    protocol: protocol ?? DEFAULT_WARMUP_PROTOCOL,
  };
}
