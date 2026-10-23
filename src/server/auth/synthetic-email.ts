/** Better Auth requires an email; GymBros only has usernames (PLAN §7). */
export const SYNTHETIC_EMAIL_DOMAIN = "gymbros.local";

/** Same normalization the Better Auth `username` plugin applies by default. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function syntheticEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
