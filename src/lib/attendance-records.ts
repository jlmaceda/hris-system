import { getUserLocation } from "@/hooks/use-geolocation";
import { getManilaDateKey, getManilaISOString } from "@/lib/local-time";
import { supabase } from "@/lib/supabaseClient";
import { uploadSelfie } from "@/lib/employee-selfies-storage";
import { addAttendanceOverlayToImage } from "@/lib/selfie-overlay";
import {
  computeNextAttemptAt,
  enqueueOfflineAttendancePunch,
  listDueOfflineAttendancePunches,
  removeOfflineAttendancePunch,
  updateOfflineAttendancePunch,
  type OfflineAttendanceQueueItem,
} from "@/lib/offline-attendance-sync";

/** Supabase table: one row per employee per calendar day (`date` column type DATE, YYYY-MM-DD). Add in SQL if missing. */
const ATTENDANCE_TABLE = "attendance";

export type AttendancePunchType = "time_in" | "break_start" | "break_end" | "time_out";

export type RecordAttendanceInput = {
  employee_id: string;
  type: AttendancePunchType;
  selfie_url: string;
  latitude: number | null;
  longitude: number | null;
};

const COLUMN_BY_TYPE: Record<AttendancePunchType, "time_in" | "break_start" | "break_end" | "time_out"> = {
  time_in: "time_in",
  break_start: "break_start",
  break_end: "break_end",
  time_out: "time_out",
};

const SELFIE_COLUMN_BY_TYPE: Record<AttendancePunchType, "time_in_selfie" | "break_start_selfie" | "break_end_selfie" | "time_out_selfie"> = {
  time_in: "time_in_selfie",
  break_start: "break_start_selfie",
  break_end: "break_end_selfie",
  time_out: "time_out_selfie",
};

type AttendanceRowUpdate = {
  time_in?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  time_out?: string | null;
  time_in_selfie?: string | null;
  break_start_selfie?: string | null;
  break_end_selfie?: string | null;
  time_out_selfie?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function isLikelyNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|offline|failed to fetch|load failed|timeout/i.test(msg);
}

/** Wait for hydrated session before RLS-protected attendance reads/writes. */
async function requireAttendanceSession(): Promise<{ error: Error | null }> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  console.log("SESSION:", session);
  if (error) {
    return { error: new Error(error.message) };
  }
  if (!session) {
    return { error: new Error("User not authenticated") };
  }
  return { error: null };
}

async function doesPunchAlreadyExist(input: {
  employee_id: string;
  type: AttendancePunchType;
  date: string;
}): Promise<{ exists: boolean; error: Error | null }> {
  const { employee_id, type, date } = input;
  const employeeId = employee_id.trim();
  const column = COLUMN_BY_TYPE[type];

  const { data, error } = await supabase
    .from(ATTENDANCE_TABLE)
    .select(`id, ${column}`)
    .eq("employee_id", employeeId)
    .eq("date", date)
    .limit(1);

  if (error) return { exists: false, error: new Error(error.message) };
  const row = Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null;
  if (!row) return { exists: false, error: null };
  return { exists: row[column] != null && String(row[column]).trim().length > 0, error: null };
}

/**
 * One row per employee per calendar day (`date` column, YYYY-MM-DD).
 * `time_in`: insert if none for today; duplicate time-in → "Already timed in".
 * Other punches: `.update` scoped by `employee_id` + `date`.
 */
export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<{ data: unknown; error: Error | null }> {
  const { employee_id, type, selfie_url, latitude, longitude } = input;
  const employeeId = employee_id?.trim();
  if (!employeeId) {
    return { data: null, error: new Error("employee_id is missing") };
  }

  if (!selfie_url?.trim()) {
    return {
      data: null,
      error: new Error("Selfie is required. Upload must succeed before attendance can be saved."),
    };
  }

  const sessionGate = await requireAttendanceSession();
  if (sessionGate.error) {
    return { data: null, error: sessionGate.error };
  }

  const today = getManilaDateKey();
  console.log("TODAY DATE:", today);

  const timeStr = getManilaISOString();

  const selfieColumn = SELFIE_COLUMN_BY_TYPE[type];

  const { data: existingList, error: fetchError } = await supabase
    .from(ATTENDANCE_TABLE)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("date", today)
    .limit(1);

  if (fetchError) {
    console.error("ATTENDANCE SELECT ERROR (continuing; insert allowed):", fetchError);
  }

  const existingRow =
    !fetchError && Array.isArray(existingList) && existingList.length > 0
      ? (existingList[0] as { id: string })
      : null;

  if (type === "time_in") {
    if (existingRow) {
      return { data: null, error: new Error("Already timed in") };
    }

    console.log("TABLE NAME:", ATTENDANCE_TABLE);
    console.log("EMPLOYEE ID:", employeeId);
    console.log("TIME:", timeStr);

    const insertPayload: Record<string, unknown> = {
      employee_id: employeeId,
      time_in: timeStr,
      [selfieColumn]: selfie_url,
      latitude,
      longitude,
      date: today,
    };

    const result = await supabase.from(ATTENDANCE_TABLE).insert(insertPayload).select("*");

    console.log("INSERT RESULT:", result);

    if (result.error) {
      return { data: null, error: new Error(result.error.message) };
    }
    const row = result.data?.[0] ?? null;
    return { data: row, error: null };
  }

  if (!existingRow) {
    return {
      data: null,
      error: new Error("No attendance record for today. Clock in (time_in) first."),
    };
  }

  const column = COLUMN_BY_TYPE[type];
  const updatePayload: AttendanceRowUpdate = {
    [column]: timeStr,
    [selfieColumn]: selfie_url,
    latitude,
    longitude,
  };
  const updateResult = await supabase
    .from(ATTENDANCE_TABLE)
    .update(updatePayload)
    .eq("employee_id", employeeId)
    .eq("date", today)
    .select("*")
    .limit(1);

  if (updateResult.error) {
    return { data: null, error: new Error(updateResult.error.message) };
  }
  const data = updateResult.data?.[0] ?? null;
  return { data, error: null };
}

/**
 * Full punch flow: session → location → overlay on image → upload selfie → `recordAttendance`.
 * Attendance is not saved unless `uploadSelfie` returns a public URL.
 */
export async function saveAttendance(
  type: AttendancePunchType,
  employeeId: string,
  imageBlob: Blob
): Promise<{ data: unknown; error: Error | null }> {
  // If we're clearly offline, queue immediately.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    try {
      const queued = await enqueueOfflineAttendancePunch({
        employee_id: employeeId,
        type,
        image_blob: imageBlob,
      });
      return { data: { queued: true, client_id: queued.client_id }, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { data: null, error: new Error(message) };
    }
  }

  const id = employeeId.trim();
  if (!id) {
    return { data: null, error: new Error("employee_id is missing") };
  }

  const sessionGate = await requireAttendanceSession();
  if (sessionGate.error) {
    return { data: null, error: sessionGate.error };
  }

  const today = getManilaDateKey();
  console.log("TODAY DATE:", today);
  if (type === "time_in") {
    const { data: existingIn, error: existingErr } = await supabase
      .from(ATTENDANCE_TABLE)
      .select("id")
      .eq("employee_id", id)
      .eq("date", today)
      .limit(1);
    if (existingErr) {
      console.error("ATTENDANCE SELECT ERROR (time_in precheck; continuing):", existingErr);
    } else if (Array.isArray(existingIn) && existingIn.length > 0) {
      return { data: null, error: new Error("Already timed in") };
    }
  }

  let latitude: number;
  let longitude: number;
  try {
    const coords = await getUserLocation();
    latitude = coords.latitude;
    longitude = coords.longitude;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not get location";
    return { data: null, error: new Error(message) };
  }

  let imageToUpload: Blob;
  try {
    imageToUpload = await addAttendanceOverlayToImage(imageBlob, { latitude, longitude });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not prepare selfie image";
    return { data: null, error: new Error(message) };
  }

  let selfie_url: string | null = null;
  try {
    selfie_url = await uploadSelfie(imageToUpload, id);
  } catch (err: unknown) {
    console.error("Upload failed:", err);
    // Offline / flaky network: queue for sync to avoid losing the punch.
    if (isLikelyNetworkError(err)) {
      try {
        const queued = await enqueueOfflineAttendancePunch({
          employee_id: id,
          type,
          image_blob: imageBlob,
        });
        return { data: { queued: true, client_id: queued.client_id }, error: null };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { data: null, error: new Error(message) };
      }
    }

    return { data: null, error: new Error("Selfie upload failed. Please try again.") };
  }

  if (!selfie_url) {
    if (typeof window !== "undefined") {
      window.alert("No selfie captured");
    }
    return { data: null, error: new Error("No selfie captured") };
  }

  console.log("SELFIE URL:", selfie_url);
  console.log("TABLE NAME:", ATTENDANCE_TABLE);
  console.log("EMPLOYEE ID:", id);

  return recordAttendance({
    employee_id: id,
    type,
    selfie_url,
    latitude,
    longitude,
  });
}

async function syncOneQueuedPunch(item: OfflineAttendanceQueueItem): Promise<{ synced: boolean; error: Error | null }> {
  const sessionGate = await requireAttendanceSession();
  if (sessionGate.error) return { synced: false, error: sessionGate.error };

  const today = getManilaDateKey();
  const existsCheck = await doesPunchAlreadyExist({
    employee_id: item.employee_id,
    type: item.type,
    date: today,
  });
  if (existsCheck.error) {
    return { synced: false, error: existsCheck.error };
  }
  if (existsCheck.exists) {
    // Already in DB → remove from queue (dedupe).
    await removeOfflineAttendancePunch(item.client_id);
    return { synced: true, error: null };
  }

  // Reuse the normal flow; if it fails with a "already timed in" / missing row, treat as synced to avoid duplicates.
  const result = await saveAttendance(item.type, item.employee_id, item.image_blob);
  if (result.error) {
    const msg = result.error.message || "";
    if (/already timed in/i.test(msg) || /no attendance record for today/i.test(msg)) {
      await removeOfflineAttendancePunch(item.client_id);
      return { synced: true, error: null };
    }
    return { synced: false, error: result.error };
  }

  await removeOfflineAttendancePunch(item.client_id);
  return { synced: true, error: null };
}

/** Public: sync all queued punches with retries and dedupe. */
export async function syncOfflineAttendanceQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return { synced: 0, remaining: 0 };
  }

  const due = await listDueOfflineAttendancePunches();
  let synced = 0;
  for (const item of due) {
    const res = await syncOneQueuedPunch(item);
    if (res.synced) {
      synced += 1;
      continue;
    }

    const attempts = (item.attempts ?? 0) + 1;
    await updateOfflineAttendancePunch(item.client_id, {
      attempts,
      next_attempt_at: computeNextAttemptAt(attempts),
    });
  }

  const remaining = (await listDueOfflineAttendancePunches(Date.now() + 365 * 24 * 60 * 60 * 1000)).length;
  return { synced, remaining };
}
