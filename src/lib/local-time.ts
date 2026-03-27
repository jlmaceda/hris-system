const MANILA_TZ = "Asia/Manila";

/**
 * Current instant as an ISO-like string in Asia/Manila wall time with explicit +08:00 offset
 * so `new Date(...)` parses the same everywhere (not device-local).
 */
export function getManilaISOString(): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hours = get("hour");
  const minutes = get("minute");
  const seconds = get("second");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

/** `YYYY-MM-DD` calendar date in Asia/Manila for the attendance `date` column. */
export function getManilaDateKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: MANILA_TZ });
}
