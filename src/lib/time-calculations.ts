const MANILA_TZ = "Asia/Manila";

export function diffInMinutes(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;

  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

  return (e.getTime() - s.getTime()) / (1000 * 60);
}

export function formatHours(minutes: number): string {
  const safe = Number.isFinite(minutes) ? minutes : 0;
  const clamped = Math.max(0, safe);

  const h = Math.floor(clamped / 60);
  const m = Math.floor(clamped % 60);
  return `${h}h ${m}m`;
}

function getManilaYMD(datetime: string): { year: number; month: number; day: number } | null {
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function calculateAttendance(record: {
  time_in?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  time_out?: string | null;
} | null | undefined): {
  total: string;
  break: string;
  net: string;
  late: string;
} {
  const time_in = record?.time_in ?? null;
  const break_start = record?.break_start ?? null;
  const break_end = record?.break_end ?? null;
  const time_out = record?.time_out ?? null;

  const totalMinutes = diffInMinutes(time_in, time_out);
  const breakMinutes = diffInMinutes(break_start, break_end);
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);

  // Late calculation (9:00 AM Manila start).
  let lateMinutes = 0;
  if (time_in) {
    const ymd = getManilaYMD(time_in);
    if (ymd) {
      const lateBaseISO = `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(
        2,
        "0"
      )}T09:00:00+08:00`;
      lateMinutes = Math.max(0, diffInMinutes(lateBaseISO, time_in));
    }
  }

  return {
    total: formatHours(totalMinutes),
    break: formatHours(breakMinutes),
    net: formatHours(netMinutes),
    late: `${Math.floor(lateMinutes)} min`,
  };
}

