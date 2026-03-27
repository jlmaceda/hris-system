const MANILA_TZ = "Asia/Manila";

/** Format ISO or DB datetime strings for display (12-hour clock, Philippine time). */
export function formatTime(datetime: string | null | undefined): string {
  if (!datetime) return "—";

  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: MANILA_TZ,
  });
}

/**
 * Format calendar dates or datetimes for display.
 * Handles `YYYY-MM-DD` without timezone shift.
 */
export function formatDate(datetime: string | null | undefined): string {
  if (!datetime) return "—";

  const trimmed = String(datetime).trim();
  if (!trimmed) return "—";

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    const date = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00+08:00`);
    return date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: MANILA_TZ,
    });
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: MANILA_TZ,
  });
}
