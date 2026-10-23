/**
 * GET /api/exercises/:slug/history[?unit=lb|kg&runId=<uuid>]
 * JSON for the weekly-load chart: { exercise, unit, runId, weekly[], sessions[] }.
 * 401 when signed out, 404 for unknown slug/run, 400 for bad params.
 */
import type { NextRequest } from "next/server";
import { getUserOrNull } from "@/server/auth/session";
import { isServiceError } from "@/server/services/errors";
import { getExerciseHistory } from "@/server/services/history.service";

const STATUS: Record<string, number> = { VALIDATION: 400, NOT_FOUND: 404 };

export async function GET(req: NextRequest, ctx: RouteContext<"/api/exercises/[slug]/history">) {
  const user = await getUserOrNull();
  if (!user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Inicia sesión" } }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  try {
    const data = await getExerciseHistory(user.id, slug, {
      displayUnit: (sp.get("unit") ?? undefined) as "lb" | "kg" | undefined,
      runId: sp.get("runId") ?? undefined,
    });
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (isServiceError(e)) {
      return Response.json(
        { error: { code: e.code, message: e.message, fieldErrors: e.fieldErrors } },
        { status: STATUS[e.code] ?? 400 },
      );
    }
    throw e;
  }
}
