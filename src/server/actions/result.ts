/**
 * Uniform return type for server actions (plain, serializable objects).
 * Not a "use server" module: it only exports types and a helper.
 */
import { unstable_rethrow } from "next/navigation";
import { isServiceError, type ServiceErrorCode } from "../services/errors";

export type ActionErrorCode = ServiceErrorCode | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> };
    };

/**
 * Run `fn`, mapping ServiceError → `{ok:false}`. Next.js control-flow errors
 * (redirect from requireUser(), notFound) are rethrown untouched.
 */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    if (isServiceError(e)) {
      return { ok: false, error: { code: e.code, message: e.message, fieldErrors: e.fieldErrors } };
    }
    console.error("[action] unexpected error", e);
    return { ok: false, error: { code: "INTERNAL", message: "Error inesperado, intenta de nuevo" } };
  }
}
