/**
 * Typed service errors. Services throw `ServiceError`; server actions turn it
 * into `ActionResult` failures. Ownership violations surface as NOT_FOUND so a
 * caller cannot probe for other users' ids.
 */
export type ServiceErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "NO_ACTIVE_RUN"
  | "NOT_ONBOARDED"
  | "WEAK_POINT_NOT_SET"
  | "EXERCISE_NOT_ALLOWED"
  | "EXERCISE_REQUIRED"
  | "CONFLICT";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ServiceErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isServiceError(e: unknown): e is ServiceError {
  return e instanceof ServiceError;
}

export function notFound(what: string): ServiceError {
  return new ServiceError("NOT_FOUND", `${what} no encontrado`);
}
